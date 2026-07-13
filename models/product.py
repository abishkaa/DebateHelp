from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import DateTime, Index, Integer, JSON, Text, func
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


class LiveDebateRoom(Base):
    __tablename__ = "live_debate_rooms"
    __table_args__ = (
        Index("ix_live_debate_rooms_host_updated", "host_user_id", "updated_at"),
        Index("ix_live_debate_rooms_opponent_updated", "opponent_user_id", "updated_at"),
    )

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    host_user_id: Mapped[str] = mapped_column(Text, nullable=False)
    host_name: Mapped[str] = mapped_column(Text, nullable=False)
    opponent_user_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    opponent_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str] = mapped_column(Text, nullable=False, default="Live Debate")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="waiting")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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


class LiveDebateStatement(Base):
    __tablename__ = "live_debate_statements"
    __table_args__ = (
        Index("ix_live_debate_statements_room_created", "room_code", "created_at"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    room_code: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    speaker_key: Mapped[str] = mapped_column(Text, nullable=False)
    speaker_name: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    reply: Mapped[str] = mapped_column(Text, nullable=False)
    analysis: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class ProgressMetric(BaseModel):
    label: str
    value: str
    change: str
    tone: str
    detail: str = ""


class DashboardInsightPublic(BaseModel):
    title: str
    detail: str
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
    insights: list[DashboardInsightPublic] = Field(default_factory=list)


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
    diagnostics: list[dict[str, Any]] = Field(default_factory=list)
    sourceSessionId: str


class LiveDebateStatementPublic(BaseModel):
    id: str
    speakerKey: str
    speakerName: str
    text: str
    reply: str
    analysis: dict[str, Any]
    score: int
    status: str
    createdAt: str


class LiveDebateRoomPublic(BaseModel):
    roomCode: str
    topic: str
    status: str
    userRole: str
    hostName: str
    opponentName: str | None = None
    participantCount: int
    canStart: bool
    canSubmit: bool
    startedAt: str | None = None
    elapsedSeconds: int = 0
    statements: list[LiveDebateStatementPublic]
    scores: dict[str, int]
    latestReply: str = ""
    latestCounterargument: str = ""
    latestAnalysis: dict[str, Any] | None = None


class LiveDebateRoomResponse(BaseModel):
    room: LiveDebateRoomPublic


class CreateLiveDebateRoomRequest(SecureRequestModel):
    topic: str | None = Field(default=None, max_length=160)

    @field_validator("topic")
    @classmethod
    def valid_topic(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return clean_text(value)


class JoinLiveDebateRoomRequest(SecureRequestModel):
    room_code: str = Field(..., min_length=4, max_length=16)

    @field_validator("room_code")
    @classmethod
    def valid_room_code(cls, value: str) -> str:
        code = clean_text(value).upper().replace(" ", "").replace("-", "")
        if not code.isalnum():
            raise ValueError("Room code can only contain letters and numbers")
        return code


class SubmitLiveDebateStatementRequest(SecureRequestModel):
    text: str = Field(..., min_length=1, max_length=8_000)

    @field_validator("text")
    @classmethod
    def valid_statement(cls, value: str) -> str:
        return clean_text(value, allow_multiline=True)


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
