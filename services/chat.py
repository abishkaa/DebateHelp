from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.message import Message

MAX_MEMORY_MESSAGES_PER_SESSION = 200
_memory_messages_by_session: dict[str, list[dict[str, object]]] = {}


async def save_exchange(
    db: AsyncSession | None,
    session_id: str,
    user_message: str,
    assistant_reply: str,
) -> None:
    if db is None:
        now = datetime.now(timezone.utc)
        messages = _memory_messages_by_session.setdefault(session_id, [])
        messages.extend(
            [
                {"role": "user", "content": user_message, "created_at": now},
                {"role": "assistant", "content": assistant_reply, "created_at": now},
            ]
        )
        del messages[:-MAX_MEMORY_MESSAGES_PER_SESSION]
        return

    db.add_all(
        [
            Message(session_id=session_id, role="user", content=user_message),
            Message(session_id=session_id, role="assistant", content=assistant_reply),
        ]
    )
    await db.commit()


async def get_history(
    db: AsyncSession | None,
    session_id: str,
    limit: int = 20,
) -> list[dict[str, str]]:
    if db is None:
        messages = _memory_messages_by_session.get(session_id, [])[-limit:]
        return [
            {
                "role": str(message["role"]),
                "content": str(message["content"]),
                "created_at": message["created_at"].isoformat(),
            }
            for message in messages
            if isinstance(message.get("created_at"), datetime)
        ]

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
