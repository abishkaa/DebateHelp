from services.oylan import send_message


async def _ask_issai_tool(tool_name: str, query: str, instructions: str) -> str:
    prompt = f"""
You are the {tool_name} tool inside Debate Coach.
This is a constrained research helper call, not a normal chat reply.

Task:
{instructions}

User/topic query:
{query}

Return a compact tool observation with:
- 2-4 useful points
- any important uncertainty or limitation
- broad source directions, institutions, datasets, or report types to verify next
- a clear "Verify before citing" note for claims that need external confirmation

Rules:
- Do not provide URLs, page titles, exact statistics, author names, study titles, publication years, or author-year citations.
- Use general source directions instead of citation-like claims.
- If the claim needs exact evidence, say what kind of source should verify it.
- Keep the response under 180 words.
""".strip()
    return await send_message(prompt)


async def search_counterarguments(query: str) -> str:
    """Use ISSAI/Oylan to produce evidence-aware objections to an argument."""
    return await _ask_issai_tool(
        tool_name="search_counterarguments",
        query=query,
        instructions=(
            "Find the strongest counterarguments to this claim. Prioritize objections "
            "that could be supported by public research, policy reports, historical "
            "examples, or expert consensus. Explain what evidence would challenge the claim, "
            "but avoid exact statistics and named citations."
        ),
    )


async def check_facts(query: str) -> str:
    """Use ISSAI/Oylan to stress-test a factual claim."""
    return await _ask_issai_tool(
        tool_name="check_facts",
        query=query,
        instructions=(
            "Check whether this claim is likely accurate, overstated, incomplete, "
            "or missing context. Separate high-confidence facts from claims that need verification."
        ),
    )


async def suggest_sources(query: str) -> str:
    """Use ISSAI/Oylan to suggest credible places to verify the debate topic."""
    return await _ask_issai_tool(
        tool_name="suggest_sources",
        query=query,
        instructions=(
            "Suggest credible source types or named sources the user can inspect next. "
            "Prefer primary data, universities, government agencies, international "
            "organizations, peer-reviewed journals, and reputable policy institutes."
        ),
    )
