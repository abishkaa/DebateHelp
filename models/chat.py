from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from models.validation import SecureRequestModel, clean_session_id, clean_text


class ChatRequest(SecureRequestModel):
    message: str = Field(..., min_length=1, max_length=12_000)
    session_id: str = Field(default="default", min_length=1, max_length=120)
    difficulty: Literal["easy", "normal", "hard"] = "normal"

    @field_validator("message")
    @classmethod
    def valid_message(cls, value: str) -> str:
        return clean_text(value, allow_multiline=True)

    @field_validator("session_id")
    @classmethod
    def valid_session_id(cls, value: str) -> str:
        return clean_session_id(value)


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    analysis: dict[str, Any] | None = None


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class HistoryResponse(BaseModel):
    session_id: str
    messages: list[HistoryMessage]
