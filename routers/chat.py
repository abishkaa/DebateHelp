from fastapi import APIRouter
from models.chat import ChatRequest
from services.chat_service import process_debate_message

router = APIRouter()

@router.post("/chat")
async def chat(request: ChatRequest):
    # The router acts as an interface that calls the service
    response_text = await process_debate_message(request.message)
    return {"reply": response_text}