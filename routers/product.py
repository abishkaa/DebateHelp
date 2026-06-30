from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_optional_db
from models.product import DashboardResponse, SessionHistoryResponse
from services.auth_service import AUTH_COOKIE_NAME, auth_error, get_user_from_token
from services.product_service import build_dashboard, get_user_sessions, serialize_session

router = APIRouter(prefix="/product", tags=["product"])
bearer_scheme = HTTPBearer(auto_error=False)


async def get_product_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession | None = Depends(get_optional_db),
):
    token = credentials.credentials if credentials is not None else request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise auth_error("Missing authorization token")
    return await get_user_from_token(db, token)


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    current_user=Depends(get_product_user),
    db: AsyncSession | None = Depends(get_optional_db),
):
    user_id = current_user["id"] if isinstance(current_user, dict) else current_user.id
    sessions = await get_user_sessions(db, user_id)
    return build_dashboard(sessions)


@router.get("/sessions", response_model=SessionHistoryResponse)
async def sessions(
    current_user=Depends(get_product_user),
    db: AsyncSession | None = Depends(get_optional_db),
):
    user_id = current_user["id"] if isinstance(current_user, dict) else current_user.id
    user_sessions = await get_user_sessions(db, user_id)
    serialized = []
    for index, session in enumerate(user_sessions):
        previous = user_sessions[index + 1].score if index + 1 < len(user_sessions) else None
        serialized.append(serialize_session(session, previous))
    return {"sessions": serialized}
