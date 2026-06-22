from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    difficulty = Column(String, default="Normal")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    messages = relationship("Message", backref="session", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "difficulty": self.difficulty,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
