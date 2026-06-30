import logging

from agent import fallback_debate_response, run_debate_agent
from sqlalchemy.ext.asyncio import AsyncSession

from services.chat import get_history, save_exchange

AGENT_HISTORY_LIMIT = 12
logger = logging.getLogger(__name__)


async def process_debate_message(
    db: AsyncSession | None,
    message: str,
    session_id: str = "default",
    difficulty: str = "normal",
) -> str:
    """Run the debate agent with persisted session history, then save this round."""
    try:
        history = await get_history(db, session_id, limit=AGENT_HISTORY_LIMIT)
    except Exception:
        logger.exception("Failed to load chat history; continuing without history.")
        history = []

    agent_history = [
        {"role": item["role"], "content": item["content"]}
        for item in history
    ]

    try:
        reply = await run_debate_agent(
            user_argument=message,
            difficulty=difficulty,
            history=agent_history,
        )
    except Exception:
        logger.exception("Debate agent failed; using deterministic fallback.")
        reply = fallback_debate_response(message, difficulty)

    try:
        await save_exchange(db, session_id, message, reply)
    except Exception:
        logger.exception("Failed to save chat exchange; returning answer anyway.")

    return reply
