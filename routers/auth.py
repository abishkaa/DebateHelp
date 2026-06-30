from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_optional_db
from models.user import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ProfileUpdateRequest,
    SignupRequest,
    UserPublic,
    VerifyEmailRequest,
    ResetPasswordRequest,
)
from services.auth_service import (
    authenticate_user,
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_SAMESITE,
    AUTH_COOKIE_SECURE,
    clear_auth_cookie,
    create_access_token,
    create_password_reset,
    create_user,
    find_or_create_oauth_user,
    get_user_from_token,
    reset_password,
    revoke_token,
    serialize_user,
    set_auth_cookie,
    update_profile,
    verify_email_token,
)
from services.oauth_service import (
    build_authorization_url,
    build_state,
    exchange_code_for_profile,
    normalize_provider,
    oauth_redirect_uri,
)
from security import enforce_auth_identifier_limit

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)
OAUTH_STATE_COOKIE_PREFIX = "debatehelp_oauth_state"
OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession | None = Depends(get_optional_db),
):
    token = credentials.credentials if credentials is not None else request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        from services.auth_service import auth_error

        raise auth_error("Missing authorization token")
    return await get_user_from_token(db, token)


@router.post("/signup", response_model=AuthResponse, response_model_exclude_none=True)
async def signup(
    request: SignupRequest,
    response: Response,
    db: AsyncSession | None = Depends(get_optional_db),
):
    await enforce_auth_identifier_limit(request.email, "signup")
    user, _ = await create_user(db, request)
    access_token = create_access_token(user)
    set_auth_cookie(response, access_token, remember=True)
    serialized_user = serialize_user(user)
    message = (
        "Account created. Finish your profile setup."
        if serialized_user.is_verified
        else "Account created. Check your email to verify your address."
    )
    return AuthResponse(
        user=serialized_user,
        message=message,
    )


@router.post("/login", response_model=AuthResponse, response_model_exclude_none=True)
async def login(
    request: LoginRequest,
    response: Response,
    db: AsyncSession | None = Depends(get_optional_db),
):
    await enforce_auth_identifier_limit(request.email, "login")
    user = await authenticate_user(db, request.email, request.password)
    access_token = create_access_token(user, remember=request.remember)
    set_auth_cookie(response, access_token, remember=request.remember)
    return AuthResponse(
        user=serialize_user(user),
        message="Login successful.",
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession | None = Depends(get_optional_db),
):
    token = credentials.credentials if credentials is not None else request.cookies.get(AUTH_COOKIE_NAME)
    if token:
        try:
            await revoke_token(db, token)
        except Exception:
            pass
    clear_auth_cookie(response)
    return MessageResponse(message="Logged out safely.")


@router.get("/me", response_model=UserPublic)
async def me(current_user=Depends(get_current_user)):
    return serialize_user(current_user)


@router.post("/profile", response_model=UserPublic)
async def profile(
    request: ProfileUpdateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession | None = Depends(get_optional_db),
):
    updated = await update_profile(db, current_user, request)
    return serialize_user(updated)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession | None = Depends(get_optional_db),
):
    await enforce_auth_identifier_limit(request.email, "forgot-password")
    await create_password_reset(db, request.email)
    return MessageResponse(
        message="If an account exists for that email, a reset link has been sent.",
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_endpoint(
    request: ResetPasswordRequest,
    db: AsyncSession | None = Depends(get_optional_db),
):
    await reset_password(db, request.token, request.password)
    return MessageResponse(message="Password reset successful. You can log in now.")


@router.post("/verify-email", response_model=AuthResponse, response_model_exclude_none=True)
async def verify_email(
    request: VerifyEmailRequest,
    response: Response,
    db: AsyncSession | None = Depends(get_optional_db),
):
    user = await verify_email_token(db, request.token)
    access_token = create_access_token(user)
    set_auth_cookie(response, access_token, remember=True)
    return AuthResponse(
        user=serialize_user(user),
        message="Email verified. Finish your profile setup.",
    )


@router.get("/oauth/{provider}/start")
async def oauth_start(
    provider: str,
    request: Request,
    next_path: str = Query("/login", alias="next"),
):
    normalized = normalize_provider(provider)
    return_to = safe_auth_return_path(next_path)
    try:
        state = build_state()
        redirect_uri = oauth_redirect_uri(request, normalized)
        authorization_url = build_authorization_url(normalized, state, redirect_uri)
    except HTTPException as exc:
        return oauth_error_redirect(str(exc.detail), return_to)

    response = RedirectResponse(authorization_url, status_code=303)
    response.set_cookie(
        key=oauth_state_cookie_name(normalized),
        value=state,
        max_age=OAUTH_STATE_MAX_AGE_SECONDS,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        path="/auth/oauth",
    )
    return response


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession | None = Depends(get_optional_db),
):
    normalized = normalize_provider(provider)
    cookie_name = oauth_state_cookie_name(normalized)

    if error:
        response = oauth_error_redirect("Sign-in was cancelled or denied.")
        response.delete_cookie(cookie_name, path="/auth/oauth")
        return response

    expected_state = request.cookies.get(cookie_name)
    if not state or not expected_state or state != expected_state:
        response = oauth_error_redirect("Sign-in expired. Please try again.")
        response.delete_cookie(cookie_name, path="/auth/oauth")
        return response

    if not code:
        response = oauth_error_redirect("Provider did not return an authorization code.")
        response.delete_cookie(cookie_name, path="/auth/oauth")
        return response

    try:
        redirect_uri = oauth_redirect_uri(request, normalized)
        profile = await exchange_code_for_profile(normalized, code, redirect_uri)
        user = await find_or_create_oauth_user(db, profile)
    except HTTPException as exc:
        response = oauth_error_redirect(str(exc.detail))
        response.delete_cookie(cookie_name, path="/auth/oauth")
        return response

    serialized_user = serialize_user(user)
    destination = "/app" if serialized_user.profile_completed else "/register"
    response = RedirectResponse(destination, status_code=303)
    response.delete_cookie(cookie_name, path="/auth/oauth")
    access_token = create_access_token(user, remember=True)
    set_auth_cookie(response, access_token, remember=True)
    return response


def oauth_state_cookie_name(provider: str) -> str:
    return f"{OAUTH_STATE_COOKIE_PREFIX}_{provider}"


def safe_auth_return_path(path: str | None) -> str:
    if path in {"/login", "/signup"}:
        return path
    return "/login"


def oauth_error_redirect(message: str, next_path: str = "/login") -> RedirectResponse:
    return_to = safe_auth_return_path(next_path)
    separator = "&" if "?" in return_to else "?"
    return RedirectResponse(
        f"{return_to}{separator}oauth_error={quote(message)}",
        status_code=303,
    )
