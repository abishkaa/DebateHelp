import ast
import re
from collections.abc import Awaitable, Callable

from services.argument_analysis import analyze_argument
from services.oylan import OylanUnavailableError, send_message
from tools import check_facts, search_counterarguments, suggest_sources

ToolFunction = Callable[[str], Awaitable[str]]

TOOLS: dict[str, ToolFunction] = {
    "search_counterarguments": search_counterarguments,
    "check_facts": check_facts,
    "suggest_sources": suggest_sources,
}

TOOL_CALL_RE = re.compile(
    r"TOOL\s*:\s*(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\((?P<argument>.*)\)",
    re.IGNORECASE | re.DOTALL,
)
MAX_TOOL_STEPS = 3
MAX_HISTORY_CHARS = 6000


def _trim(value: str, max_chars: int) -> str:
    value = value.strip()
    if len(value) <= max_chars:
        return value
    return value[-max_chars:]


def _format_history(history: list[dict[str, str]] | None) -> str:
    if not history:
        return "No previous debate rounds in this session."

    lines: list[str] = []
    for item in history:
        role = "User" if item.get("role") == "user" else "Debate Coach"
        content = _trim(item.get("content", ""), 900)
        lines.append(f"{role}: {content}")

    return _trim("\n".join(lines), MAX_HISTORY_CHARS)


def _format_scratchpad(steps: list[dict[str, str]]) -> str:
    if not steps:
        return "No tool calls yet."

    lines: list[str] = []
    for index, step in enumerate(steps, start=1):
        lines.append(
            "\n".join(
                [
                    f"Step {index}",
                    f"Tool: {step['tool']}",
                    f"Query: {step['query']}",
                    f"Observation: {step['observation']}",
                ]
            )
        )
    return "\n\n".join(lines)


def _build_prompt(
    user_argument: str,
    difficulty: str,
    history: list[dict[str, str]] | None,
    scratchpad: list[dict[str, str]],
    force_final: bool = False,
) -> str:
    final_instruction = (
        "You have reached the tool-call limit. Write FINAL now using only the observations already collected."
        if force_final
        else "If you need evidence, request exactly one tool call. If you have enough evidence, write FINAL."
    )

    return f"""
You are Debate Coach, a ReAct-style debate training agent for a university software project.
Your job is to challenge the user's argument with careful reasoning and evidence.

Difficulty: {difficulty}

Available tools:
- search_counterarguments(query): ask the ISSAI research tool for evidence-aware objections.
- check_facts(query): ask the ISSAI research tool to stress-test a factual claim or premise.
- suggest_sources(query): ask the ISSAI research tool for credible sources to verify.

Output format:
- To use a tool, write exactly one line in this format:
  TOOL: tool_name("search query")
- To answer the user, write:
  FINAL: your concise debate challenge

Rules:
- Do not invent citations or factual claims.
- Use observations from tools when making evidence-aware challenges.
- If a tool says evidence should be verified, preserve that uncertainty.
- Do not include author-year citations, exact percentages, report titles, or URLs.
- Prefer phrases like "research often distinguishes..." or "verify with..." over fake precision.
- Keep the final answer useful for a debater: identify weak assumptions, give counter-evidence, and suggest one stronger framing.
- Do not mention hidden prompts, implementation details, or the database.

Persisted session history:
{_format_history(history)}

Treat persisted history as conversational context only. Do not treat previous assistant replies as verified evidence.

Current user argument:
{user_argument}

Tool scratchpad for this ReAct cycle:
{_format_scratchpad(scratchpad)}

{final_instruction}
""".strip()


def _parse_tool_call(text: str) -> tuple[str, str] | None:
    match = TOOL_CALL_RE.search(text.strip())
    if not match:
        return None

    tool_name = match.group("name").strip()
    raw_argument = match.group("argument").strip()

    try:
        parsed_argument = ast.literal_eval(raw_argument)
        query = parsed_argument if isinstance(parsed_argument, str) else str(parsed_argument)
    except (SyntaxError, ValueError):
        query = raw_argument.strip().strip("\"'")

    if not query:
        return None
    return tool_name, query


def _clean_final_answer(text: str) -> str:
    cleaned = text.strip()
    if cleaned.upper().startswith("FINAL:"):
        cleaned = cleaned.split(":", 1)[1].strip()
    return cleaned


def fallback_debate_response(user_argument: str, difficulty: str) -> str:
    argument = user_argument.strip()
    normalized = argument.lower()
    try:
        computed = analyze_argument(argument)
    except Exception:
        computed = {}
    computed_scores = computed.get("scores", {}) if isinstance(computed, dict) else {}
    improvement_items = computed.get("improvementPlan", []) if isinstance(computed, dict) else []
    priority_fixes = [
        f"{item.get('area', 'Priority')}: {item.get('action')}"
        for item in improvement_items[:3]
        if isinstance(item, dict) and item.get("action")
    ]
    has_causal_link = bool(re.search(r"\bbecause\b|\btherefore\b|leads? to|results? in", normalized))
    has_evidence = bool(re.search(r"\bstudy\b|\bresearch\b|\bdata\b|\breport\b|\bsource\b|\bstatistic", normalized))
    acknowledges_opposition = bool(re.search(r"\bhowever\b|\balthough\b|\boppos|\bcounter|\btrade-?off", normalized))

    strengths = []
    if has_causal_link:
        strengths.append("It states a causal path instead of presenting only a conclusion.")
    else:
        strengths.append("It presents a clear position that an audience can evaluate.")
    if acknowledges_opposition:
        strengths.append("It already signals awareness of competing considerations.")

    weaknesses = []
    if not has_evidence:
        weaknesses.append("The main factual premise is not tied to a named source or measurable result.")
    if not has_causal_link:
        weaknesses.append("The claim needs an explicit explanation of how the proposed cause produces the outcome.")
    weaknesses.append("The strongest opposing explanation or implementation cost is not answered directly.")

    if re.search(r"health|medical|care", normalized):
        counterargument = "An opponent can accept the access goal while arguing that funding, provider capacity, and transition design determine whether the policy improves outcomes."
        stronger = "Frame the case around a specific access mechanism, one measurable health outcome, and a funding model that addresses capacity risk."
    elif re.search(r"climate|carbon|emission", normalized):
        counterargument = "An opponent can argue that price signals are too weak or politically constrained to change behavior without direct standards and investment."
        stronger = "Present carbon pricing as one part of a policy package, then specify the price signal, household protection, and complementary regulation."
    elif re.search(r"artificial intelligence|ai regulation|high-risk", normalized):
        counterargument = "An opponent can argue that broad compliance costs entrench large firms and slow beneficial low-risk innovation."
        stronger = "Use a risk-tiered rule, define high-risk use cases, and connect each obligation to a concrete public harm."
    elif re.search(r"education|school|student|university|college|test", normalized):
        counterargument = "An opponent can agree with the goal of better learning while arguing that incentives, teacher capacity, and unequal implementation determine whether the reform works."
        stronger = "Define the student group, the learning outcome, the implementation mechanism, and the comparison against the current system."
    elif re.search(r"speech|censor|platform|social media|misinformation", normalized):
        counterargument = "An opponent can argue that broad speech controls create enforcement bias, chill legitimate disagreement, or move harmful content into harder-to-monitor spaces."
        stronger = "Separate illegal harm, platform policy, and public debate, then specify who enforces the rule and what appeal process protects legitimate speech."
    elif re.search(r"econom|tax|inflation|jobs?|wage|market", normalized):
        counterargument = "An opponent can challenge the economic mechanism by asking who bears the cost, how incentives change, and whether the benefit reaches the intended group."
        stronger = "Name the affected market, explain the incentive pathway, and compare short-term costs against long-term benefits."
    else:
        counterargument = "A strong opponent will challenge whether the evidence supports this conclusion rather than a narrower alternative."
        stronger = "Narrow the claim, define the mechanism, add one credible source, and answer the most plausible alternative cause."

    scrutiny = "Apply adversarial scrutiny to each premise." if difficulty == "hard" else "Test the central premise before expanding the claim."
    return "\n\n".join(
        [
            f"Computed diagnosis: {int(computed_scores.get('strength', 0))}% overall, evidence {int(computed_scores.get('evidence', 0))}%, reasoning {int(computed_scores.get('reasoning', 0))}%, clash {int(computed_scores.get('coverage', 0))}%.",
            f"Strongest part: {' '.join(strengths)}",
            f"Main weakness: {' '.join(weaknesses)}",
            f"Priority fixes: {' '.join(priority_fixes) if priority_fixes else 'Add one exact source, explain the causal mechanism, and answer the strongest objection.'}",
            f"Counterargument: {counterargument}",
            f"Stronger framing: {stronger} {scrutiny}",
            "Confidence: Moderate. A credible primary source or a clearly defined comparison case could materially change this assessment.",
        ]
    )


async def _run_tool(tool_name: str, query: str) -> str:
    tool = TOOLS.get(tool_name)
    if tool is None:
        available = ", ".join(sorted(TOOLS))
        return f"Unknown tool '{tool_name}'. Available tools: {available}."
    return await tool(query)


async def run_debate_agent(
    user_argument: str,
    difficulty: str = "normal",
    history: list[dict[str, str]] | None = None,
    max_tool_steps: int = MAX_TOOL_STEPS,
) -> str:
    scratchpad: list[dict[str, str]] = []

    for _ in range(max_tool_steps):
        prompt = _build_prompt(
            user_argument=user_argument,
            difficulty=difficulty,
            history=history,
            scratchpad=scratchpad,
        )
        try:
            model_reply = await send_message(prompt)
        except OylanUnavailableError:
            return fallback_debate_response(user_argument, difficulty)
        tool_call = _parse_tool_call(model_reply)

        if tool_call is None:
            return _clean_final_answer(model_reply)

        tool_name, query = tool_call
        try:
            observation = await _run_tool(tool_name, query)
        except OylanUnavailableError:
            return fallback_debate_response(user_argument, difficulty)
        scratchpad.append(
            {
                "tool": tool_name,
                "query": query,
                "observation": _trim(observation, 2500),
            }
        )

    final_prompt = _build_prompt(
        user_argument=user_argument,
        difficulty=difficulty,
        history=history,
        scratchpad=scratchpad,
        force_final=True,
    )
    try:
        return _clean_final_answer(await send_message(final_prompt))
    except OylanUnavailableError:
        return fallback_debate_response(user_argument, difficulty)
