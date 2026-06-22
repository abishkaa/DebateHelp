from sqlalchemy.future import Session as SyncSession
from sqlalchemy import select
from database import AsyncSessionLocal, engine, Base
from models.message import Message, Session as SessionModel
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

async def init_db():
    """Initialize the database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_session_history(session_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a session, ordered by creation time."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at)
        )
        messages = result.scalars().all()
        return [msg.to_dict() for msg in messages]

async def save_message(session_id: str, role: str, content: str) -> Message:
    """Save a message to the database."""
    async with AsyncSessionLocal() as db:
        message = Message(
            session_id=session_id,
            role=role,
            content=content
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message

async def get_or_create_session(session_id: str, difficulty: str = "Normal") -> SessionModel:
    """Get an existing session or create a new one."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SessionModel).where(SessionModel.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            session = SessionModel(id=session_id, difficulty=difficulty)
            db.add(session)
            await db.commit()
            await db.refresh(session)
        
        return session

async def delete_session(session_id: str) -> bool:
    """Delete a session and all its messages."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SessionModel).where(SessionModel.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            await db.delete(session)
            await db.commit()
            return True
        return False

async def get_all_sessions() -> List[Dict[str, Any]]:
    """Get all sessions."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SessionModel).order_by(SessionModel.created_at.desc()))
        sessions = result.scalars().all()
        return [s.to_dict() for s in sessions]
