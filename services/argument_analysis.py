from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any


WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]*|\d+(?:\.\d+)?%?")
SENTENCE_RE = re.compile(r"[^.!?\n]+[.!?]?")

CLAIM_RE = re.compile(
    r"\b(?:should|must|need(?:s)? to|ought to|therefore|i (?:argue|believe)|this house|policy|ban|legalize|regulate)\b",
    re.IGNORECASE,
)
EVIDENCE_RE = re.compile(
    r"https?://\S+|\b\d{4}\b|\b\d+(?:\.\d+)?%|\b(?:study|report|research|source|data|survey|journal|experiment|according to|evidence|statistics?)\b",
    re.IGNORECASE,
)
REASONING_RE = re.compile(
    r"\b(?:because|therefore|since|as a result|leads? to|causes?|results? in|means that|so that|consequently|if .+ then)\b",
    re.IGNORECASE,
)
COUNTER_RE = re.compile(
    r"\b(?:however|although|even if|opponent|opposition|counter|rebut|trade-?off|on the other hand|critics|against|despite)\b",
    re.IGNORECASE,
)
IMPACT_RE = re.compile(
    r"\b(?:impact|harm|benefit|cost|risk|rights?|safety|equity|freedom|welfare|outcomes?|incentive|capacity|implementation)\b",
    re.IGNORECASE,
)
QUALIFIER_RE = re.compile(
    r"\b(?:often|usually|likely|may|might|can|in many cases|some|most|depends|unless|when|under)\b",
    re.IGNORECASE,
)

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "to", "of", "in", "on",
    "for", "with", "by", "as", "is", "are", "be", "this", "that", "it",
    "from", "at", "we", "they", "their", "our", "will", "would", "should",
}

TOPIC_PATTERNS = [
    (r"\b(?:healthcare|health care|medical|medicine|public health)\b", "Universal Healthcare"),
    (r"basic income|\bubi\b|income guarantee", "Universal Basic Income"),
    (r"artificial intelligence|ai regulation|high-risk systems|\bai\b", "AI Regulation"),
    (r"climate|carbon|emission|renewable|fossil", "Climate Policy"),
    (r"education|school|standardized test|university|student", "Education Reform"),
    (r"speech|censor|platform|misinformation|social media", "Speech and Platform Policy"),
    (r"tax|inflation|wage|jobs?|market|econom", "Economic Policy"),
]

FALLACY_RULES = [
    (
        "False dilemma",
        re.compile(r"\b(?:either|only two|no alternative|the only option|must choose)\b", re.IGNORECASE),
        "The wording may frame the debate as fewer options than actually exist.",
        10,
    ),
    (
        "Hasty generalization",
        re.compile(r"\b(?:all|everyone|nobody|always|never|every single|proves that all)\b", re.IGNORECASE),
        "Absolute language needs stronger evidence or narrower wording.",
        9,
    ),
    (
        "Causal overclaim",
        re.compile(r"\b(?:guarantees|will definitely|automatically|inevitably|single-handedly|proves that)\b", re.IGNORECASE),
        "The causal claim may be stronger than the evidence can support.",
        12,
    ),
    (
        "Ad hominem risk",
        re.compile(r"\b(?:idiot|stupid|corrupt people|evil people|brainwashed|morons?)\b", re.IGNORECASE),
        "Attacking people instead of the warrant weakens the argument.",
        14,
    ),
    (
        "Appeal to popularity",
        re.compile(r"\b(?:everyone knows|most people think|popular opinion|common sense proves)\b", re.IGNORECASE),
        "Popularity is not enough without a mechanism or source.",
        8,
    ),
    (
        "Slippery slope risk",
        re.compile(r"\b(?:slippery slope|will lead to everything|next thing you know|opens the door to)\b", re.IGNORECASE),
        "The chain of consequences needs intermediate proof.",
        9,
    ),
]


def clamp(value: float, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, round(value)))


def score_ceiling(word_count: int, signal_count: int) -> int:
    """Cap scores when the submission is too short to carry a real debate burden."""
    if word_count <= 1:
        return 6
    if word_count < 5:
        return min(14, 8 + signal_count * 2)
    if word_count < 12:
        return min(42, 20 + word_count + signal_count * 4)
    if word_count < 25:
        return min(62, 34 + word_count + signal_count * 4)
    if word_count < 60:
        return min(84, 52 + round(word_count * 0.45) + signal_count * 3)
    return 100


def words(text: str) -> list[str]:
    return [match.group(0).lower() for match in WORD_RE.finditer(text)]


def sentences(text: str) -> list[str]:
    return [
        match.group(0).strip()
        for match in SENTENCE_RE.finditer(text)
        if match.group(0).strip()
    ]


def short_excerpt(text: str, limit: int = 180) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit].rstrip()}..."


def infer_topic(text: str) -> str:
    normalized = text.lower()
    for pattern, topic in TOPIC_PATTERNS:
        if re.search(pattern, normalized):
            return topic
    keywords = [
        token for token, _ in Counter(
            word for word in words(text) if word not in STOPWORDS and len(word) > 3
        ).most_common(3)
    ]
    return " ".join(keyword.capitalize() for keyword in keywords) or "Argument Analysis"


def count_syllables(word: str) -> int:
    cleaned = re.sub(r"[^a-z]", "", word.lower())
    if not cleaned:
        return 1
    groups = re.findall(r"[aeiouy]+", cleaned)
    count = len(groups)
    if cleaned.endswith("e") and count > 1:
        count -= 1
    return max(1, count)


def readability_grade(tokens: list[str], sentence_count: int) -> float:
    if not tokens or not sentence_count:
        return 0.0
    syllables = sum(count_syllables(token) for token in tokens)
    return max(0.0, 0.39 * (len(tokens) / sentence_count) + 11.8 * (syllables / len(tokens)) - 15.59)


def extract_sources(text: str) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []
    seen: set[str] = set()

    for match in EVIDENCE_RE.finditer(text):
        signal = match.group(0).rstrip(".,);]")
        key = signal.lower()
        if key in seen:
            continue
        seen.add(key)

        if signal.startswith(("http://", "https://")):
            signals.append(
                {
                    "source": signal,
                    "detail": "URL supplied by the user; verify author, date, and methodology before citing.",
                    "credibility": 78,
                    "tone": "green",
                }
            )
        elif re.fullmatch(r"\d+(?:\.\d+)?%", signal):
            signals.append(
                {
                    "source": signal,
                    "detail": "Statistic present, but it still needs a named source and context.",
                    "credibility": 56,
                    "tone": "amber",
                }
            )
        elif re.fullmatch(r"\d{4}", signal):
            signals.append(
                {
                    "source": signal,
                    "detail": "Year detected; connect it to a study, law, case, or event.",
                    "credibility": 48,
                    "tone": "amber",
                }
            )
        else:
            signals.append(
                {
                    "source": signal,
                    "detail": "Evidence keyword detected; name the exact source to raise credibility.",
                    "credibility": 52,
                    "tone": "amber",
                }
            )

    return signals[:8]


def detect_fallacies(text: str) -> list[dict[str, Any]]:
    flags: list[dict[str, Any]] = []
    for name, pattern, detail, penalty in FALLACY_RULES:
        match = pattern.search(text)
        if not match:
            continue
        flags.append(
            {
                "name": name,
                "detail": detail,
                "severity": "high" if penalty >= 12 else "medium",
                "excerpt": short_excerpt(match.group(0), 90),
                "penalty": penalty,
            }
        )
    return flags


def score_argument(text: str) -> dict[str, Any]:
    token_list = words(text)
    sentence_list = sentences(text)
    word_count = len(token_list)
    sentence_count = max(1, len(sentence_list))
    unique_words = {token for token in token_list if token not in STOPWORDS}
    lexical_diversity = len(unique_words) / max(1, word_count)
    avg_sentence_length = word_count / sentence_count
    grade = readability_grade(token_list, sentence_count)

    claim_hits = len(CLAIM_RE.findall(text))
    evidence_hits = len(EVIDENCE_RE.findall(text))
    reasoning_hits = len(REASONING_RE.findall(text))
    counter_hits = len(COUNTER_RE.findall(text))
    impact_hits = len(IMPACT_RE.findall(text))
    qualifier_hits = len(QUALIFIER_RE.findall(text))
    fallacies = detect_fallacies(text)
    fallacy_penalty = sum(int(item["penalty"]) for item in fallacies)
    source_signals = extract_sources(text)
    exact_source_count = sum(
        1
        for source in source_signals
        if str(source.get("tone")) == "green"
        or str(source.get("source", "")).startswith(("http://", "https://"))
    )
    signal_count = (
        claim_hits
        + evidence_hits
        + reasoning_hits
        + counter_hits
        + impact_hits
        + qualifier_hits
        + exact_source_count
    )
    ceiling = score_ceiling(word_count, signal_count)

    length_score = clamp((word_count / 140) * 100)
    claim_clarity = min(
        ceiling,
        clamp(
            claim_hits * 22
            + impact_hits * 4
            + min(28, word_count * 1.2)
            + (10 if word_count >= 18 and sentence_count >= 2 else 0)
            - max(0, avg_sentence_length - 32),
        ),
    )
    evidence_quality = min(
        ceiling,
        0 if not source_signals else clamp(
            evidence_hits * 12
            + exact_source_count * 24
            + min(16, word_count / 18)
            + (8 if any(source["tone"] == "green" for source in source_signals) else 0)
        ),
    )
    reasoning_depth = min(
        ceiling,
        clamp(
            reasoning_hits * 18
            + impact_hits * 9
            + claim_hits * 5
            + min(18, max(0, word_count - 4) * 0.6)
            + min(8, lexical_diversity * 10)
        ),
    )
    counter_coverage = min(
        ceiling,
        clamp(counter_hits * 25 + qualifier_hits * 6 + (8 if counter_hits and word_count >= 40 else 0)),
    )
    readability = 0 if word_count < 6 else clamp(100 - abs(grade - 10) * 5 - max(0, avg_sentence_length - 34))
    logical_consistency = min(
        ceiling,
        clamp(
            min(24, max(0, word_count - 3) * 1.2)
            + claim_hits * 13
            + reasoning_hits * 15
            + impact_hits * 5
            + qualifier_hits * 4
            + (10 if 6 <= avg_sentence_length <= 28 and word_count >= 8 else 0)
            + (6 if evidence_hits else 0)
            - fallacy_penalty
        ),
    )
    strength = clamp(
        claim_clarity * 0.22
        + evidence_quality * 0.22
        + reasoning_depth * 0.24
        + counter_coverage * 0.14
        + logical_consistency * 0.14
        + length_score * 0.04
    )

    return {
        "strength": strength,
        "claim_clarity": claim_clarity,
        "evidence": evidence_quality,
        "reasoning": reasoning_depth,
        "coverage": counter_coverage,
        "logic": logical_consistency,
        "readability": readability,
        "score_ceiling": ceiling,
        "low_information": word_count < 6 or (word_count < 12 and signal_count < 2),
        "word_count": word_count,
        "sentence_count": len(sentence_list),
        "avg_sentence_length": round(avg_sentence_length, 1),
        "readability_grade": round(grade, 1),
        "lexical_diversity": round(lexical_diversity, 2),
        "claim_hits": claim_hits,
        "evidence_hits": evidence_hits,
        "reasoning_hits": reasoning_hits,
        "counter_hits": counter_hits,
        "impact_hits": impact_hits,
        "qualifier_hits": qualifier_hits,
    }


def key_sentences(text: str, limit: int = 3) -> list[str]:
    ranked = []
    for sentence in sentences(text):
        signal_score = 0
        signal_score += 4 if CLAIM_RE.search(sentence) else 0
        signal_score += 4 if EVIDENCE_RE.search(sentence) else 0
        signal_score += 3 if REASONING_RE.search(sentence) else 0
        signal_score += 2 if IMPACT_RE.search(sentence) else 0
        signal_score += min(3, len(words(sentence)) / 12)
        ranked.append((signal_score, sentence))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [sentence for _, sentence in ranked[:limit] if sentence]


def matching_sentences(text: str, patterns: list[re.Pattern[str]], limit: int = 2) -> list[str]:
    matches: list[str] = []
    for sentence in sentences(text):
        if any(pattern.search(sentence) for pattern in patterns):
            matches.append(short_excerpt(sentence, 180))
        if len(matches) >= limit:
            break
    return matches


def score_status(score: int | float) -> str:
    numeric = int(score)
    if numeric >= 82:
        return "strong"
    if numeric >= 65:
        return "usable"
    if numeric >= 45:
        return "needs work"
    return "urgent"


def metric_diagnostics(
    text: str,
    scores: dict[str, Any],
    fallacies: list[dict[str, Any]],
    sources: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    named_or_url_sources = [
        source for source in sources
        if str(source.get("tone")) == "green" or str(source.get("source", "")).startswith(("http://", "https://"))
    ]
    fallback_excerpts = key_sentences(text, 1) or ([short_excerpt(text)] if text.strip() else [])
    claim_excerpts = matching_sentences(text, [CLAIM_RE, IMPACT_RE]) or fallback_excerpts
    evidence_excerpts = matching_sentences(text, [EVIDENCE_RE]) or fallback_excerpts
    reasoning_excerpts = matching_sentences(text, [REASONING_RE, IMPACT_RE]) or fallback_excerpts
    coverage_excerpts = matching_sentences(text, [COUNTER_RE, QUALIFIER_RE]) or fallback_excerpts
    logic_excerpts = [
        str(item.get("excerpt") or item.get("detail"))
        for item in fallacies[:2]
        if item.get("excerpt") or item.get("detail")
    ] or fallback_excerpts

    return [
        {
            "area": "Claim clarity",
            "score": int(scores["claim_clarity"]),
            "status": score_status(scores["claim_clarity"]),
            "signal": f"{scores['claim_hits']} claim marker(s), {scores['word_count']} words",
            "meaning": "Measures whether the argument clearly names an actor, action, and outcome.",
            "why": (
                f"Earned {int(scores['claim_clarity'])}% because the analyzer found "
                f"{scores['claim_hits']} claim marker(s) across {scores['word_count']} words."
            ),
            "influencedBy": claim_excerpts,
            "weakness": "The claim needs a more explicit actor, action, mechanism, or measurable outcome." if scores["claim_clarity"] < 72 else "The claim is readable; the next gain is tighter framing and weighing.",
            "improve": "Open with one sentence that says who should do what, why it works, and what outcome proves success.",
        },
        {
            "area": "Evidence quality",
            "score": int(scores["evidence"]),
            "status": score_status(scores["evidence"]),
            "signal": f"{scores['evidence_hits']} evidence signal(s), {len(named_or_url_sources)} exact/link citation(s)",
            "meaning": "Measures named sources, statistics, years, URLs, studies, and verifiable data signals.",
            "why": (
                f"Earned {int(scores['evidence'])}% because the text contains "
                f"{scores['evidence_hits']} evidence signal(s) and {len(named_or_url_sources)} exact/link citation(s)."
            ),
            "influencedBy": evidence_excerpts,
            "weakness": "The evidence is not tied to a verifiable source, date, method, or exact result." if not named_or_url_sources else "Evidence exists; explain why that source proves the central premise.",
            "improve": "Add one named source with date, method, and the exact fact it proves.",
        },
        {
            "area": "Reasoning depth",
            "score": int(scores["reasoning"]),
            "status": score_status(scores["reasoning"]),
            "signal": f"{scores['reasoning_hits']} causal connector(s), {scores['impact_hits']} impact marker(s)",
            "meaning": "Measures whether the claim explains the mechanism connecting evidence to impact.",
            "why": (
                f"Earned {int(scores['reasoning'])}% from {scores['reasoning_hits']} causal connector(s) "
                f"and {scores['impact_hits']} impact marker(s)."
            ),
            "influencedBy": reasoning_excerpts,
            "weakness": "The warrant needs a clearer cause-to-effect chain." if scores["reasoning"] < 72 else "The warrant is present; make it harder to attack by adding comparison or probability.",
            "improve": "Use a because-chain: cause -> mechanism -> affected group -> measurable result.",
        },
        {
            "area": "Counterargument coverage",
            "score": int(scores["coverage"]),
            "status": score_status(scores["coverage"]),
            "signal": f"{scores['counter_hits']} opposition marker(s), {scores['qualifier_hits']} qualifier(s)",
            "meaning": "Measures whether the argument anticipates objections, tradeoffs, and alternative explanations.",
            "why": (
                f"Earned {int(scores['coverage'])}% because DebateHelp found "
                f"{scores['counter_hits']} opposition marker(s) and {scores['qualifier_hits']} qualifier(s)."
            ),
            "influencedBy": coverage_excerpts,
            "weakness": "The strongest objection or tradeoff is not answered directly." if scores["counter_hits"] == 0 else "Opposition is acknowledged; sharpen the response into direct clash.",
            "improve": "Add one concession-plus-answer sentence: even if the opponent says X, your side still wins because Y.",
        },
        {
            "area": "Logical consistency",
            "score": int(scores["logic"]),
            "status": score_status(scores["logic"]),
            "signal": f"{len(fallacies)} fallacy flag(s), average sentence length {scores['avg_sentence_length']} words",
            "meaning": "Measures overclaiming, absolute language, attacks, false choices, and readability pressure.",
            "why": (
                f"Earned {int(scores['logic'])}% after checking {len(fallacies)} fallacy flag(s), "
                f"sentence length, qualifiers, and causal structure."
            ),
            "influencedBy": logic_excerpts,
            "weakness": fallacies[0]["detail"] if fallacies else "No major fallacy pattern was detected; watch for unsupported leaps between premise and impact.",
            "improve": "Narrow absolute wording, add missing conditions, and split dense claims into separate premise/evidence/warrant sentences.",
        },
    ]


def improvement_plan(
    text: str,
    topic: str,
    scores: dict[str, Any],
    fallacies: list[dict[str, Any]],
    sources: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    plans: list[dict[str, Any]] = []
    has_exact_source = any(
        str(source.get("tone")) == "green" or str(source.get("source", "")).startswith(("http://", "https://"))
        for source in sources
    )

    def add(
        area: str,
        score_key: str,
        problem: str,
        why: str,
        action: str,
        example: str,
        detected: str,
        priority: int,
    ) -> None:
        score = int(scores.get(score_key, 0))
        plans.append(
            {
                "area": area,
                "score": score,
                "status": score_status(score),
                "problem": problem,
                "why": why,
                "action": action,
                "example": example,
                "detected": detected,
                "priority": priority,
            }
        )

    if scores["claim_clarity"] < 72:
        add(
            "Claim",
            "claim_clarity",
            "The central claim is not yet framed as a clear actor, action, and measurable outcome.",
            "A judge needs to know exactly what policy or position you defend before weighing evidence.",
            "Rewrite the opening as actor + action + mechanism + outcome.",
            f"{topic}: The actor should do X because it changes Y, producing Z measurable benefit.",
            f"{scores['claim_hits']} claim marker(s) detected.",
            1,
        )
    elif scores["word_count"] < 90:
        add(
            "Claim",
            "claim_clarity",
            "The claim is readable, but the argument is still too short to carry a full debate burden.",
            "Short arguments often skip definitions, mechanism, and weighing, which makes them easy to attack.",
            "Add one definition sentence and one sentence explaining the standard for winning the debate.",
            "Define the key term, then say which impact should matter most and why.",
            f"{scores['word_count']} words detected.",
            5,
        )

    if scores["evidence"] < 72 or not has_exact_source:
        if not sources:
            problem = "No citation, statistic, study, report, year, URL, or named evidence signal was detected."
            detected = "0 evidence signals detected."
        elif not has_exact_source:
            problem = "Evidence language is present, but it is not tied to an exact source or link."
            detected = f"{len(sources)} loose evidence signal(s), 0 exact/link citation(s)."
        else:
            problem = "Evidence exists, but it needs more context to prove the central premise."
            detected = f"{len(sources)} evidence signal(s) detected."
        add(
            "Evidence",
            "evidence",
            problem,
            "Evidence only persuades when the audience can verify who found it, when, and under what conditions.",
            "Add one named source with date, method, and the exact fact it proves.",
            "According to [organization/report/year], [specific finding], which proves [premise].",
            detected,
            2,
        )

    if scores["reasoning"] < 72 or scores["reasoning_hits"] < 2:
        add(
            "Reasoning",
            "reasoning",
            "The causal warrant is under-explained.",
            "Opponents can concede your fact but deny that it causes your conclusion.",
            "Add a because-chain: cause -> mechanism -> affected group -> measurable outcome.",
            "This causes the outcome because it changes incentives/capacity/behavior in this specific way.",
            f"{scores['reasoning_hits']} reasoning connector(s), {scores['impact_hits']} impact marker(s).",
            3,
        )

    if scores["coverage"] < 68 or scores["counter_hits"] == 0:
        add(
            "Clash",
            "coverage",
            "The argument does not directly answer the strongest opposing explanation or tradeoff.",
            "Debates are won on clash; ignoring the best objection lets the opponent define the round.",
            "Add a concession-plus-answer sentence that names the opponent's best point and explains why yours still wins.",
            "Even if opponents argue [best objection], my side still wins because [comparative reason].",
            f"{scores['counter_hits']} counterargument marker(s), {scores['qualifier_hits']} qualifier(s).",
            4,
        )

    if scores["impact_hits"] == 0:
        add(
            "Impact weighing",
            "reasoning",
            "The argument does not clearly weigh why the outcome matters more than competing concerns.",
            "A good impact tells the judge magnitude, probability, timeframe, or affected group.",
            "Add one impact-weighing sentence that compares your benefit against the main cost.",
            "This matters more because it affects [group] at [scale] sooner/more certainly than the alternative.",
            "0 impact markers detected.",
            5,
        )

    if fallacies:
        first = fallacies[0]
        add(
            "Logic",
            "logic",
            f"{first['name']} risk: {first['detail']}",
            "A reasoning-risk flag means the wording may be too absolute, too personal, or missing intermediate proof.",
            "Narrow the wording and add the missing condition or exception before presenting it.",
            "Replace absolute language with a qualified claim and one condition under which it would not hold.",
            f"{len(fallacies)} fallacy flag(s) detected.",
            6,
        )

    if scores["avg_sentence_length"] > 34 or scores["readability"] < 58:
        add(
            "Delivery",
            "readability",
            "The sentence structure is likely too dense for live debating.",
            "Judges and opponents process shorter signposted claims more reliably under time pressure.",
            "Split the longest sentence into claim, evidence, and warrant.",
            "First: claim. Second: evidence. Third: why that evidence proves the claim.",
            f"Average sentence length is {scores['avg_sentence_length']} words; readability grade is {scores['readability_grade']}.",
            7,
        )

    if not plans:
        plans.append(
            {
                "area": "Advanced polish",
                "score": int(scores["strength"]),
                "status": score_status(scores["strength"]),
                "problem": "The core structure is strong; the next gain is precision, not basic repair.",
                "why": "High-scoring arguments improve by becoming harder to misinterpret or turn.",
                "action": "Add a comparison case, quantify the main impact, and pre-answer the opponent's most technical objection.",
                "example": "Compared with [alternative], this works better because [mechanism] produces [measured impact].",
                "detected": f"{scores['evidence_hits']} evidence signal(s), {scores['reasoning_hits']} reasoning connector(s), {scores['counter_hits']} counter marker(s).",
                "priority": 1,
            }
        )

    plans.sort(key=lambda item: (int(item["score"]), int(item["priority"])))
    return plans[:6]


def recommendations(
    scores: dict[str, Any],
    fallacies: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    plan: list[dict[str, Any]] | None = None,
) -> list[str]:
    if plan:
        return [str(item["action"]) for item in plan[:5]]

    tips: list[str] = []
    if scores["claim_clarity"] < 65:
        tips.append("State the main claim in one sentence using clear actor, action, and outcome.")
    if scores["evidence"] < 65:
        tips.append("Add at least one named source, statistic, case, or URL for the central factual premise.")
    if scores["reasoning"] < 65:
        tips.append("Explain the warrant: why the evidence proves the claim and what mechanism links cause to effect.")
    if scores["coverage"] < 60:
        tips.append("Add the strongest opposing argument, then answer it directly.")
    if fallacies:
        tips.append(f"Revise the flagged {fallacies[0]['name'].lower()} risk before using this in a debate.")
    if sources and all(source["tone"] != "green" for source in sources):
        tips.append("Turn evidence keywords into precise citations with author, organization, or link.")
    return tips[:5] or ["The structure is usable; improve by adding more precise evidence and a sharper rebuttal."]


def counter_guidance(text: str, topic: str, scores: dict[str, Any]) -> list[str]:
    normalized = text.lower()
    if "AI Regulation" in topic:
        base = "An opponent can argue broad regulation raises compliance costs, entrenches incumbents, and slows low-risk innovation."
    elif "Healthcare" in topic:
        base = "An opponent can accept the access goal while attacking funding, wait times, capacity, or transition costs."
    elif "Climate" in topic:
        base = "An opponent can challenge whether the policy changes incentives fast enough without unfairly raising household costs."
    elif "Education" in topic:
        base = "An opponent can argue implementation quality, teacher capacity, and unequal resources determine whether the reform works."
    elif "Speech" in topic:
        base = "An opponent can argue enforcement bias and chilling effects outweigh the proposed safety benefit."
    else:
        base = "An opponent will likely challenge whether the evidence proves this conclusion over a narrower alternative."

    second = (
        "Because counterargument coverage is currently low, explicitly concede the strongest tradeoff before rebutting it."
        if scores["coverage"] < 60
        else "Your argument already gestures at opposition; tighten it into a direct concession-plus-answer structure."
    )
    if "ban" in normalized:
        second = "If you defend a ban, explain why lighter regulation would be insufficient."
    return [base, second]


def analyze_argument(argument: str, reply: str = "") -> dict[str, Any]:
    clean_argument = argument.strip()
    topic = infer_topic(clean_argument)
    scores = score_argument(clean_argument)
    sources = extract_sources(clean_argument)
    fallacies = detect_fallacies(clean_argument)
    key_args = key_sentences(clean_argument)
    plan = improvement_plan(clean_argument, topic, scores, fallacies, sources)
    tips = recommendations(scores, fallacies, sources, plan)
    diagnostics = metric_diagnostics(clean_argument, scores, fallacies, sources)
    counters = counter_guidance(clean_argument, topic, scores)
    low_information = bool(scores.get("low_information"))
    if low_information:
        counters = [
            "No meaningful counterargument can be generated from this submission yet.",
            "Write a complete claim first, then DebateHelp can test the strongest opposing response.",
        ]

    evidence_note = (
        "No concrete citation signals were found. Add a named study, report, dataset, statistic, case, or URL."
        if not sources
        else f"{len(sources)} evidence signal{'s' if len(sources) != 1 else ''} found; strongest signal credibility is {max(source['credibility'] for source in sources)}%."
    )
    if low_information:
        fallacy_note = "Too little argumentative content was provided to evaluate fallacy risk reliably."
    elif fallacies:
        fallacy_note = (
            f"Flagged {len(fallacies)} reasoning risk{'s' if len(fallacies) != 1 else ''}: "
            + ", ".join(item["name"] for item in fallacies[:3])
        )
    else:
        fallacy_note = "No major fallacy pattern was detected by the local analyzer."
    why = (
        f"Score is computed from {scores['word_count']} words, {scores['evidence_hits']} evidence signals, "
        f"{scores['reasoning_hits']} reasoning connectors, {scores['counter_hits']} counterargument markers, "
        f"{scores['impact_hits']} impact markers, and {len(fallacies)} fallacy flags. "
        f"Weakest area: {plan[0]['area']} at {plan[0]['score']}%."
    )
    change = (
        tips[0]
        if tips
        else "A stronger source or clearer counterargument could still change the score."
    )
    low_information_answer = (
        "This submission is too short to evaluate as a debate argument. Add a clear claim, a because-reason, "
        "one piece of evidence, and at least one answer to the strongest objection before trusting the percentages."
    )
    coach_summary = (
        low_information_answer
        if low_information
        else short_excerpt(reply, 240)
        if reply
        else f"{topic}: current argument strength is {scores['strength']}% with evidence at {scores['evidence']}%."
    )

    return {
        "topic": topic,
        "scores": scores,
        "sources": sources,
        "diagnostics": diagnostics,
        "fallacies": [
            {key: value for key, value in item.items() if key != "penalty"}
            for item in fallacies
        ],
        "recommendations": tips,
        "improvementPlan": [
            {key: value for key, value in item.items() if key != "priority"}
            for item in plan
        ],
        "priorityActions": [str(item["action"]) for item in plan[:3]],
        "key_arguments": key_args or ([short_excerpt(clean_argument)] if clean_argument else []),
        "evidence": [
            f"{source['source']}: {source['detail']}"
            for source in sources
        ] or [evidence_note],
        "counterarguments": counters,
        "answer": low_information_answer if low_information else reply or "Run analysis to generate coaching text.",
        "why": why,
        "evidenceNote": evidence_note,
        "counterargument": " ".join(counters),
        "change": change,
        "coachSummary": coach_summary,
        "fallacyNote": fallacy_note,
        "lowInformation": low_information,
        "method": "local_nlp_diagnostic_scoring_v3",
    }
