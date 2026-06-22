from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.chat import ChatRequest, ChatResponse, HistoryResponse
from services.chat import get_history
from services.chat_service import process_debate_message

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    response_text = await process_debate_message(
        db=db,
        message=request.message,
        session_id=request.session_id,
        difficulty=request.difficulty,
    )
    return {"reply": response_text, "session_id": request.session_id}


@router.get("/history/{session_id}", response_model=HistoryResponse)
async def history(session_id: str, db: AsyncSession = Depends(get_db)):
    messages = await get_history(db, session_id, limit=50)
    return {"session_id": session_id, "messages": messages}
