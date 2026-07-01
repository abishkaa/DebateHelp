from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_optional_db
from models.product import (
    CreateTeamInviteRequest,
    DashboardResponse,
    ReportPublic,
    SaveSharedArgumentRequest,
    SessionHistoryResponse,
    SharedArgumentsResponse,
    TeamMembersResponse,
)
from services.auth_service import AUTH_COOKIE_NAME, auth_error, get_user_from_token
from services.product_service import (
    build_dashboard,
    build_session_report,
    get_shared_arguments,
    get_team_members,
    get_user_sessions,
    save_shared_argument,
    save_team_invite,
    serialize_session,
)


def session_score(session) -> int:
    return int(session["score"] if isinstance(session, dict) else session.score)

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
        previous = session_score(user_sessions[index + 1]) if index + 1 < len(user_sessions) else None
        serialized.append(serialize_session(session, previous))
    return {"sessions": serialized}


@router.get("/team", response_model=TeamMembersResponse)
async def team_members(
    current_user=Depends(get_product_user),
    db: AsyncSession | None = Depends(get_optional_db),
):
    return {"members": await get_team_members(db, current_user)}


@router.post("/team/invites", response_model=TeamMembersResponse)
async def invite_team_member(
    request: CreateTeamInviteRequest,
    current_user=Depends(get_product_user),
    db: AsyncSession | None = Depends(get_optional_db),
):
    current_email = current_user["email"] if isinstance(current_user, dict) else current_user.email
    if request.email == current_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this workspace.",
        )

    members = await save_team_invite(db, current_user, request.email, request.role)
    return {"members": members}


@router.get("/shared-arguments", response_model=SharedArgumentsResponse)
async def shared_arguments(
    current_user=Depends(get_product_user),
    db: AsyncSession | None = Depends(get_optional_db),
):
    user_id = current_user["id"] if isinstance(current_user, dict) else current_user.id
    return {"arguments": await get_shared_arguments(db, user_id)}


@router.post("/shared-arguments", response_model=SharedArgumentsResponse)
async def save_shared_argument_route(
    request: SaveSharedArgumentRequest,
    current_user=Depends(get_product_user),
    db: AsyncSession | None = Depends(get_optional_db),
):
    arguments = await save_shared_argument(
        db,
        current_user,
        title=request.title,
        body=request.body,
        argument_id=request.id,
    )
    return {"arguments": arguments}


@router.get("/reports/{session_id}", response_model=ReportPublic)
async def report(
    session_id: str,
    current_user=Depends(get_product_user),
    db: AsyncSession | None = Depends(get_optional_db),
):
    from models.validation import clean_session_id

    try:
        safe_session_id = clean_session_id(session_id)
        user_id = current_user["id"] if isinstance(current_user, dict) else current_user.id
        return await build_session_report(db, user_id, safe_session_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
