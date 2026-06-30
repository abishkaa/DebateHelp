from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, DateTime, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base
from models.validation import (
    SecureRequestModel,
    clean_email,
    clean_http_url,
    clean_optional_text,
    clean_password,
    clean_profile_image_url,
    clean_text,
    clean_token,
)

UserRole = Literal["Student", "Debater", "Teacher", "Researcher", "Coach", "Other"]


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email_unique", "email", unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[UserRole] = mapped_column(Text, nullable=False, default="Student")
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    debate_level: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_debate_format: Mapped[str | None] = mapped_column(Text, nullable=True)
    main_interests: Mapped[str | None] = mapped_column(Text, nullable=True)
    organization: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    auth_provider: Mapped[str] = mapped_column(Text, nullable=False, default="email")
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    profile_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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


class UserPublic(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    purpose: str | None = None
    debate_level: str | None = None
    preferred_debate_format: str | None = None
    main_interests: str | None = None
    organization: str | None = None
    profile_image_url: str | None = None
    auth_provider: str = "email"
    is_verified: bool
    profile_completed: bool


class SignupRequest(SecureRequestModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = "Student"
    purpose: str | None = Field(default=None, max_length=240)

    @field_validator("full_name")
    @classmethod
    def valid_full_name(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("password", "confirm_password")
    @classmethod
    def valid_password(cls, value: str) -> str:
        return clean_password(value)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        return clean_email(value)

    @field_validator("purpose")
    @classmethod
    def valid_purpose(cls, value: str | None) -> str | None:
        return clean_optional_text(value)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, value: str, info) -> str:
        password = info.data.get("password")
        if password and value != password:
            raise ValueError("Passwords do not match")
        return value


class LoginRequest(SecureRequestModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)
    remember: bool = False

    @field_validator("email")
    @classmethod
    def login_valid_email(cls, value: str) -> str:
        return clean_email(value)

    @field_validator("password")
    @classmethod
    def login_valid_password(cls, value: str) -> str:
        return clean_password(value)


class ForgotPasswordRequest(SecureRequestModel):
    email: str = Field(..., min_length=5, max_length=254)

    @field_validator("email")
    @classmethod
    def forgot_valid_email(cls, value: str) -> str:
        return clean_email(value)


class ResetPasswordRequest(SecureRequestModel):
    token: str = Field(..., min_length=12, max_length=512)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("token")
    @classmethod
    def valid_token(cls, value: str) -> str:
        return clean_token(value)

    @field_validator("password", "confirm_password")
    @classmethod
    def valid_password(cls, value: str) -> str:
        return clean_password(value)

    @field_validator("confirm_password")
    @classmethod
    def reset_passwords_match(cls, value: str, info) -> str:
        password = info.data.get("password")
        if password and value != password:
            raise ValueError("Passwords do not match")
        return value


class VerifyEmailRequest(SecureRequestModel):
    token: str = Field(..., min_length=12, max_length=512)

    @field_validator("token")
    @classmethod
    def valid_token(cls, value: str) -> str:
        return clean_token(value)


class OAuthRequest(SecureRequestModel):
    access_token: str | None = Field(default=None, max_length=4_096)
    code: str | None = Field(default=None, max_length=2_048)
    redirect_uri: str | None = Field(default=None, max_length=500)

    @field_validator("access_token", "code")
    @classmethod
    def valid_oauth_value(cls, value: str | None) -> str | None:
        return clean_optional_text(value)

    @field_validator("redirect_uri")
    @classmethod
    def valid_redirect_uri(cls, value: str | None) -> str | None:
        return clean_http_url(value)


class ProfileUpdateRequest(SecureRequestModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    role: UserRole | None = None
    purpose: str | None = Field(default=None, max_length=240)
    debate_level: str | None = Field(default=None, max_length=80)
    preferred_debate_format: str | None = Field(default=None, max_length=80)
    main_interests: str | None = Field(default=None, max_length=240)
    organization: str | None = Field(default=None, max_length=160)
    profile_image_url: str | None = Field(default=None, max_length=80_000)

    @field_validator(
        "full_name",
        "purpose",
        "debate_level",
        "preferred_debate_format",
        "main_interests",
        "organization",
    )
    @classmethod
    def valid_profile_text(cls, value: str | None) -> str | None:
        return clean_optional_text(value)

    @field_validator("profile_image_url")
    @classmethod
    def valid_profile_image_url(cls, value: str | None) -> str | None:
        return clean_profile_image_url(value)


class AuthResponse(BaseModel):
    user: UserPublic
    message: str


class MessageResponse(BaseModel):
    message: str
