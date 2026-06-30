from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.chat import ChatRequest, ChatResponse, HistoryResponse
from services.auth_service import AUTH_COOKIE_NAME, get_user_from_token
from services.chat import get_history
from services.chat_service import process_debate_message
from services.product_service import record_debate_session

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    token = credentials.credentials if credentials is not None else request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    user = await get_user_from_token(db, token)
    user_id = user["id"] if isinstance(user, dict) else user.id
    storage_session_id = f"{user_id}:{payload.session_id}"
    response_text = await process_debate_message(
        db=db,
        message=payload.message,
        session_id=storage_session_id,
        difficulty=payload.difficulty,
    )
    await record_debate_session(
        db=db,
        user_id=user_id,
        session_id=storage_session_id,
        message=payload.message,
        reply=response_text,
    )
    return {"reply": response_text, "session_id": payload.session_id}


@router.get("/history/{session_id}", response_model=HistoryResponse)
async def history(
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    token = credentials.credentials if credentials is not None else request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )
    from models.validation import clean_session_id

    try:
        safe_session_id = clean_session_id(session_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    user = await get_user_from_token(db, token)
    user_id = user["id"] if isinstance(user, dict) else user.id
    storage_session_id = f"{user_id}:{safe_session_id}"
    messages = await get_history(db, storage_session_id, limit=50)
    return {"session_id": session_id, "messages": messages}
