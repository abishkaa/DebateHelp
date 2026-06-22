from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ChatRequest(BaseModel):
    message: str
    session_id: str
    difficulty: Optional[str] = "Normal"

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    tools_used: Optional[List[str]] = []
    citations: Optional[List[str]] = []

class MessageHistory(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True