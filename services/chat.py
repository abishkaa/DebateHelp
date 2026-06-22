from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.message import Message


async def save_exchange(
    db: AsyncSession,
    session_id: str,
    user_message: str,
    assistant_reply: str,
) -> None:
    db.add_all(
        [
            Message(session_id=session_id, role="user", content=user_message),
            Message(session_id=session_id, role="assistant", content=assistant_reply),
        ]
    )
    await db.commit()


async def get_history(
    db: AsyncSession,
    session_id: str,
    limit: int = 20,
) -> list[dict[str, str]]:
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
    )
    messages = list(reversed(result.scalars().all()))

    return [
        {
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        for message in messages
    ]
