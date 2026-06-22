from fastapi import APIRouter, HTTPException, Depends
from models.chat import ChatRequest, ChatResponse, MessageHistory
from services.chat_service import process_debate_message
from services.chat import get_session_history, save_message, get_or_create_session
from typing import List

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process a debate message with ReAct agent loop."""
    try:
        # Get or create session in DB
        session = await get_or_create_session(request.session_id, request.difficulty)
        
        # Save user message to DB
        await save_message(request.session_id, "user", request.message)
        
        # Get conversation history for context
        history = await get_session_history(request.session_id)
        
        # Convert history to format expected by agent
        messages = [{"role": msg["role"], "content": msg["content"]} for msg in history]
        
        # Run the ReAct agent loop
        reply, tools_used, citations = await process_debate_message(
            messages, 
            request.difficulty
        )
        
        # Save assistant reply to DB
        await save_message(request.session_id, "assistant", reply)
        
        return ChatResponse(
            reply=reply,
            session_id=request.session_id,
            tools_used=tools_used,
            citations=citations
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{session_id}", response_model=List[MessageHistory])
async def get_history(session_id: str):
    """Get the chat history for a specific session."""
    try:
        history = await get_session_history(session_id)
        if not history:
            raise HTTPException(status_code=404, detail="Session not found")
        return history
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))