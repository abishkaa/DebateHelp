from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import DateTime, Index, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class DebateSession(Base):
    __tablename__ = "debate_sessions"
    __table_args__ = (
        Index("ix_debate_sessions_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    argument_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ProgressMetric(BaseModel):
    label: str
    value: str
    change: str
    tone: str


class DebateSessionPublic(BaseModel):
    id: str
    title: str
    topic: str
    score: int
    date: str
    trend: str
    argument_count: int


class AchievementPublic(BaseModel):
    title: str
    description: str
    progress: int
    status: str
    tone: str


class DashboardResponse(BaseModel):
    metrics: list[ProgressMetric]
    progress_series: list[int]
    recent_sessions: list[DebateSessionPublic]
    achievements: list[AchievementPublic]


class SessionHistoryResponse(BaseModel):
    sessions: list[DebateSessionPublic]
