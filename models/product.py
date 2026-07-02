from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import DateTime, Index, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base
from models.validation import SecureRequestModel, clean_email, clean_text


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


class TeamMemberInvite(Base):
    __tablename__ = "team_member_invites"
    __table_args__ = (
        Index(
            "ix_team_member_invites_owner_email_unique",
            "workspace_owner_user_id",
            "email",
            unique=True,
        ),
        Index(
            "ix_team_member_invites_owner_updated",
            "workspace_owner_user_id",
            "updated_at",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    workspace_owner_user_id: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False, default="Debater")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="Invited")
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


class SharedArgument(Base):
    __tablename__ = "shared_arguments"
    __table_args__ = (
        Index("ix_shared_arguments_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    owner: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="Draft")
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


class ReportPublic(BaseModel):
    topic: str
    score: int
    recommendation: str
    keyArguments: list[str]
    evidence: list[str]
    fallacies: list[str]
    counterarguments: list[str]
    improvementPlan: list[dict[str, Any]] = Field(default_factory=list)
    sourceSessionId: str


class SharedArgumentPublic(BaseModel):
    id: str
    title: str
    body: str
    owner: str
    citations: int
    status: str
    updated_at: str


class SharedArgumentsResponse(BaseModel):
    arguments: list[SharedArgumentPublic]


class SaveSharedArgumentRequest(SecureRequestModel):
    id: str | None = Field(default=None, max_length=120)
    title: str = Field(..., min_length=1, max_length=160)
    body: str = Field(..., min_length=1, max_length=12_000)

    @field_validator("title")
    @classmethod
    def valid_title(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("body")
    @classmethod
    def valid_body(cls, value: str) -> str:
        return clean_text(value, allow_multiline=True)


TEAM_MEMBER_ROLES = {"Debater", "Researcher", "Coach", "Speaker"}


class TeamMemberPublic(BaseModel):
    id: str
    email: str
    name: str
    initials: str
    role: str
    status: str
    tone: str
    is_current: bool = False


class CreateTeamInviteRequest(SecureRequestModel):
    email: str = Field(..., min_length=5, max_length=254)
    role: str = Field(default="Debater", min_length=2, max_length=40)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        return clean_email(value)

    @field_validator("role")
    @classmethod
    def valid_role(cls, value: str) -> str:
        role = clean_text(value)
        if role not in TEAM_MEMBER_ROLES:
            raise ValueError("Choose a supported team role")
        return role


class TeamMembersResponse(BaseModel):
    members: list[TeamMemberPublic]
