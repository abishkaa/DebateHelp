from agent import run_debate_agent
from sqlalchemy.ext.asyncio import AsyncSession

from services.chat import get_history, save_exchange

AGENT_HISTORY_LIMIT = 12


async def process_debate_message(
    db: AsyncSession,
    message: str,
    session_id: str = "default",
    difficulty: str = "normal",
) -> str:
    """Run the debate agent with persisted session history, then save this round."""
    history = await get_history(db, session_id, limit=AGENT_HISTORY_LIMIT)
    agent_history = [
        {"role": item["role"], "content": item["content"]}
        for item in history
    ]

    reply = await run_debate_agent(
        user_argument=message,
        difficulty=difficulty,
        history=agent_history,
    )
    await save_exchange(db, session_id, message, reply)
    return reply
