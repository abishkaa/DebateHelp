from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AuthOneTimeToken(Base):
    __tablename__ = "auth_one_time_tokens"
    __table_args__ = (
        CheckConstraint(
            "purpose in ('verify_email', 'reset_password')",
            name="auth_one_time_tokens_purpose_check",
        ),
        Index(
            "ix_auth_one_time_tokens_hash_unique",
            "token_hash",
            unique=True,
        ),
        Index(
            "ix_auth_one_time_tokens_user_purpose",
            "user_id",
            "purpose",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class RevokedAccessToken(Base):
    __tablename__ = "revoked_access_tokens"

    token_id: Mapped[str] = mapped_column(Text, primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class UserAuthState(Base):
    __tablename__ = "user_auth_states"

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    tokens_valid_after_ms: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
