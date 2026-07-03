import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, cast

from fastapi import HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend_env import load_backend_env
from models.auth_security import AuthOneTimeToken, RevokedAccessToken, UserAuthState
from models.user import ProfileUpdateRequest, SignupRequest, User, UserPublic
from services.email_service import (
    validate_email_configuration,
    send_password_reset_email,
    send_verification_email,
)

load_backend_env()

JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
JWT_EXPIRES_IN = os.getenv("JWT_EXPIRES_IN", "7d")
PASSWORD_ITERATIONS = int(os.getenv("PASSWORD_ITERATIONS", "600000"))
VERIFICATION_TOKEN_TTL = int(os.getenv("VERIFICATION_TOKEN_TTL_SECONDS", "86400"))
RESET_TOKEN_TTL = int(os.getenv("RESET_TOKEN_TTL_SECONDS", "3600"))
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "debatehelp_session")
AUTH_COOKIE_SECURE = os.getenv(
    "AUTH_COOKIE_SECURE",
    "true" if os.getenv("ENV", "development").lower() == "production" else "false",
).lower() in {"1", "true", "yes"}
AUTH_COOKIE_SAMESITE = cast(
    Literal["lax", "strict", "none"],
    os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower(),
)
ENVIRONMENT = os.getenv("ENV", "development").lower()
REQUIRE_EMAIL_VERIFICATION = os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").lower() in {
    "1",
    "true",
    "yes",
}

_memory_users_by_id: dict[str, dict[str, Any]] = {}
_memory_users_by_email: dict[str, str] = {}
_verification_tokens: dict[str, tuple[str, int]] = {}
_reset_tokens: dict[str, tuple[str, int]] = {}
_revoked_token_ids: dict[str, int] = {}
_tokens_valid_after_by_user: dict[str, int] = {}
CLEARABLE_PROFILE_FIELDS = {
    "purpose",
    "debate_level",
    "preferred_debate_format",
    "main_interests",
    "organization",
    "profile_image_url",
}


def validate_auth_configuration() -> None:
    if len(JWT_SECRET) < 32:
        raise RuntimeError(
            "JWT_SECRET must be set to a random value of at least 32 characters."
        )
    if PASSWORD_ITERATIONS < 600_000:
        raise RuntimeError("PASSWORD_ITERATIONS must be at least 600000.")
    if VERIFICATION_TOKEN_TTL <= 0 or RESET_TOKEN_TTL <= 0:
        raise RuntimeError("Authentication token TTL values must be positive.")
    if AUTH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
        raise RuntimeError("AUTH_COOKIE_SAMESITE must be lax, strict, or none.")
    if AUTH_COOKIE_SAMESITE == "none" and not AUTH_COOKIE_SECURE:
        raise RuntimeError("SameSite=None cookies must also be Secure.")
    if any(
        placeholder in JWT_SECRET.lower()
        for placeholder in ("change-me", "generate-a-random", "dev-only")
    ):
        raise RuntimeError("JWT_SECRET cannot use an example or development value.")
    if ENVIRONMENT == "production":
        if not os.getenv("DATABASE_URL", "").strip():
            raise RuntimeError("DATABASE_URL is required in production.")
        if not AUTH_COOKIE_SECURE:
            raise RuntimeError("AUTH_COOKIE_SECURE must be true in production.")
        frontend_url = os.getenv("FRONTEND_URL", "").strip()
        if not frontend_url.startswith("https://"):
            raise RuntimeError("FRONTEND_URL must use HTTPS in production.")
        configured_origins = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "").split(",")
            if origin.strip()
        ]
        if not configured_origins or any(
            not origin.startswith("https://")
            for origin in configured_origins
        ):
            raise RuntimeError(
                "CORS_ORIGINS must contain explicit HTTPS origins in production."
            )
    validate_email_configuration()
    parse_expiry(JWT_EXPIRES_IN)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt}${digest}"


DUMMY_PASSWORD_HASH = hash_password("timing-only-password-value")


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False

    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    try:
        iteration_count = int(iterations)
    except ValueError:
        return False
    if iteration_count <= 0 or iteration_count > 10_000_000:
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iteration_count,
    ).hex()
    return hmac.compare_digest(digest, expected)


def password_needs_rehash(stored_hash: str | None) -> bool:
    if not stored_hash:
        return True
    try:
        algorithm, iterations, _, _ = stored_hash.split("$", 3)
        return algorithm != "pbkdf2_sha256" or int(iterations) < PASSWORD_ITERATIONS
    except (TypeError, ValueError):
        return True


def hash_one_time_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user: User | dict[str, Any], remember: bool = False) -> str:
    user_id = user["id"] if isinstance(user, dict) else user.id
    email = user["email"] if isinstance(user, dict) else user.email
    now = int(time.time())
    expires_in = parse_expiry(JWT_EXPIRES_IN)
    if remember:
        expires_in = max(expires_in, 60 * 60 * 24 * 30)

    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "iat_ms": int(time.time() * 1000),
        "exp": now + expires_in,
        "typ": "access",
        "jti": secrets.token_urlsafe(16),
    }
    return encode_jwt(payload)


def set_auth_cookie(
    response: Response,
    token: str,
    *,
    remember: bool = False,
) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=60 * 60 * 24 * 30 if remember else None,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        path="/",
    )


def encode_jwt(payload: dict[str, Any]) -> str:
    validate_auth_configuration()
    header = {"alg": "HS256", "typ": "JWT"}
    header_segment = b64url_json(header)
    payload_segment = b64url_json(payload)
    signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_segment}.{payload_segment}.{b64url(signature)}"


def decode_jwt(token: str) -> dict[str, Any]:
    if len(token) > 4_096:
        raise auth_error("Invalid token")
    try:
        header_segment, payload_segment, signature_segment = token.split(".")
        header = json.loads(b64url_decode(header_segment))
        if header != {"alg": "HS256", "typ": "JWT"}:
            raise ValueError("Unsupported JWT header")

        signing_input = f"{header_segment}.{payload_segment}".encode("utf-8")
        expected = hmac.new(
            JWT_SECRET.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        supplied = b64url_decode(signature_segment)
        if not hmac.compare_digest(expected, supplied):
            raise ValueError("Invalid signature")

        payload = json.loads(b64url_decode(payload_segment))
        now = int(time.time())
        if int(payload.get("exp", 0)) < now:
            raise auth_error("Token has expired")
        if int(payload.get("iat", now + 1)) > now + 300:
            raise ValueError("Invalid issued-at time")
        if (
            payload.get("typ") != "access"
            or not payload.get("sub")
            or not payload.get("jti")
            or not isinstance(payload.get("iat_ms"), int)
        ):
            raise ValueError("Invalid access token")
        return payload
    except HTTPException:
        raise
    except (ValueError, TypeError, KeyError, json.JSONDecodeError, binascii.Error) as exc:
        raise auth_error("Invalid token") from exc


def b64url_json(value: dict[str, Any]) -> str:
    return b64url(json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8"))


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def parse_expiry(raw_value: str) -> int:
    value = raw_value.strip().lower()
    if value.isdigit():
        seconds = int(value)
        if seconds <= 0:
            raise RuntimeError("JWT_EXPIRES_IN must be positive.")
        return seconds

    if len(value) < 2:
        raise RuntimeError("JWT_EXPIRES_IN must be seconds or use m, h, or d.")
    unit = value[-1:]
    try:
        amount = int(value[:-1])
    except ValueError as exc:
        raise RuntimeError("JWT_EXPIRES_IN must be seconds or use m, h, or d.") from exc
    if amount <= 0:
        raise RuntimeError("JWT_EXPIRES_IN must be positive.")
    if unit == "m":
        return amount * 60
    if unit == "h":
        return amount * 60 * 60
    if unit == "d":
        return amount * 60 * 60 * 24
    raise RuntimeError("JWT_EXPIRES_IN must use m, h, or d.")


def auth_error(message: str, code: int = status.HTTP_401_UNAUTHORIZED) -> HTTPException:
    return HTTPException(status_code=code, detail=message)


def serialize_user(user: User | dict[str, Any]) -> UserPublic:
    if isinstance(user, dict):
        return UserPublic.model_validate(user)

    return UserPublic(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        purpose=user.purpose,
        debate_level=user.debate_level,
        preferred_debate_format=user.preferred_debate_format,
        main_interests=user.main_interests,
        organization=user.organization,
        profile_image_url=user.profile_image_url,
        auth_provider=user.auth_provider,
        is_verified=user.is_verified,
        profile_completed=user.profile_completed,
    )


async def find_user_by_email(db: AsyncSession | None, email: str) -> User | dict[str, Any] | None:
    normalized = normalize_email(email)
    if db is None:
        user_id = _memory_users_by_email.get(normalized)
        return _memory_users_by_id.get(user_id or "")

    result = await db.execute(select(User).where(User.email == normalized))
    return result.scalar_one_or_none()


async def find_user_by_id(db: AsyncSession | None, user_id: str) -> User | dict[str, Any] | None:
    if db is None:
        return _memory_users_by_id.get(user_id)

    return await db.get(User, user_id)


async def create_user(db: AsyncSession | None, request: SignupRequest) -> tuple[User | dict[str, Any], str | None]:
    email = normalize_email(request.email)
    existing = await find_user_by_email(db, email)
    if existing:
        hash_password(request.password)
        raise auth_error(
            "An account with this email already exists. Sign in instead, or reset your password if you forgot it.",
            status.HTTP_409_CONFLICT,
        )

    user_id = str(uuid.uuid4())
    verification_token = secrets.token_urlsafe(32) if REQUIRE_EMAIL_VERIFICATION else None
    password_hash = hash_password(request.password)
    is_verified = not REQUIRE_EMAIL_VERIFICATION

    if db is None:
        user = {
            "id": user_id,
            "email": email,
            "full_name": request.full_name.strip(),
            "password_hash": password_hash,
            "role": request.role,
            "purpose": request.purpose,
            "debate_level": None,
            "preferred_debate_format": None,
            "main_interests": None,
            "organization": None,
            "profile_image_url": None,
            "auth_provider": "email",
            "is_verified": is_verified,
            "profile_completed": False,
            "created_at": datetime.now(timezone.utc),
        }
        _memory_users_by_id[user_id] = user
        _memory_users_by_email[email] = user_id
    else:
        user = User(
            id=user_id,
            email=email,
            full_name=request.full_name.strip(),
            password_hash=password_hash,
            role=request.role,
            purpose=request.purpose,
            auth_provider="email",
            is_verified=is_verified,
            profile_completed=False,
        )
        db.add(user)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            hash_password(request.password)
            raise auth_error(
                "An account with this email already exists. Sign in instead, or reset your password if you forgot it.",
                status.HTTP_409_CONFLICT,
            ) from exc
        await db.refresh(user)

    if verification_token is not None:
        await store_one_time_token(
            db,
            user_id,
            verification_token,
            "verify_email",
            VERIFICATION_TOKEN_TTL,
        )
        await send_verification_email(email, verification_token)
    return user, verification_token


async def authenticate_user(
    db: AsyncSession | None,
    email: str,
    password: str,
) -> User | dict[str, Any]:
    user = await find_user_by_email(db, email)
    if not user:
        verify_password(password, DUMMY_PASSWORD_HASH)
        raise auth_error("Invalid email or password")

    password_hash = user["password_hash"] if isinstance(user, dict) else user.password_hash
    if not verify_password(password, password_hash):
        raise auth_error("Invalid email or password")
    if password_needs_rehash(password_hash):
        upgraded_hash = hash_password(password)
        if isinstance(user, dict):
            user["password_hash"] = upgraded_hash
        else:
            user.password_hash = upgraded_hash
            assert db is not None
            await db.commit()
    if not REQUIRE_EMAIL_VERIFICATION:
        await mark_user_verified(db, user)
    return user


async def mark_user_verified(
    db: AsyncSession | None,
    user: User | dict[str, Any],
) -> User | dict[str, Any]:
    if isinstance(user, dict):
        user["is_verified"] = True
        return user

    if not user.is_verified:
        user.is_verified = True
        assert db is not None
        await db.commit()
        await db.refresh(user)
    return user


async def find_or_create_oauth_user(
    db: AsyncSession | None,
    profile: dict[str, Any],
) -> User | dict[str, Any]:
    email = normalize_email(str(profile["email"]))
    provider = str(profile.get("provider") or "oauth")
    full_name = str(profile.get("full_name") or email.split("@", 1)[0]).strip()
    profile_image_url = profile.get("profile_image_url")
    existing = await find_user_by_email(db, email)

    if existing:
        if isinstance(existing, dict):
            existing["is_verified"] = True
            if not existing.get("full_name") and full_name:
                existing["full_name"] = full_name
            if not existing.get("profile_image_url") and profile_image_url:
                existing["profile_image_url"] = profile_image_url
            if existing.get("auth_provider") == "email":
                existing["auth_provider"] = provider
            return existing

        existing.is_verified = True
        if not existing.full_name and full_name:
            existing.full_name = full_name
        if not existing.profile_image_url and profile_image_url:
            existing.profile_image_url = profile_image_url
        if existing.auth_provider == "email":
            existing.auth_provider = provider
        assert db is not None
        await db.commit()
        await db.refresh(existing)
        return existing

    user_id = str(uuid.uuid4())
    if db is None:
        user = {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "password_hash": None,
            "role": "Student",
            "purpose": None,
            "debate_level": None,
            "preferred_debate_format": None,
            "main_interests": None,
            "organization": None,
            "profile_image_url": profile_image_url,
            "auth_provider": provider,
            "is_verified": True,
            "profile_completed": False,
            "created_at": datetime.now(timezone.utc),
        }
        _memory_users_by_id[user_id] = user
        _memory_users_by_email[email] = user_id
        return user

    user = User(
        id=user_id,
        email=email,
        full_name=full_name,
        password_hash=None,
        role="Student",
        purpose=None,
        profile_image_url=profile_image_url,
        auth_provider=provider,
        is_verified=True,
        profile_completed=False,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await find_user_by_email(db, email)
        if existing:
            if isinstance(existing, dict):
                existing["is_verified"] = True
                if not existing.get("full_name") and full_name:
                    existing["full_name"] = full_name
                if not existing.get("profile_image_url") and profile_image_url:
                    existing["profile_image_url"] = profile_image_url
                if existing.get("auth_provider") == "email":
                    existing["auth_provider"] = provider
                return existing

            existing.is_verified = True
            if not existing.full_name and full_name:
                existing.full_name = full_name
            if not existing.profile_image_url and profile_image_url:
                existing.profile_image_url = profile_image_url
            if existing.auth_provider == "email":
                existing.auth_provider = provider
            await db.commit()
            await db.refresh(existing)
            return existing
        raise
    await db.refresh(user)
    return user


async def verify_email_token(db: AsyncSession | None, token: str) -> User | dict[str, Any]:
    user_id = await consume_one_time_token(db, token, "verify_email")
    if not user_id:
        raise auth_error("Verification link is invalid or expired.", status.HTTP_400_BAD_REQUEST)

    user = await find_user_by_id(db, user_id)
    if not user:
        raise auth_error("Account no longer exists.", status.HTTP_404_NOT_FOUND)

    if isinstance(user, dict):
        user["is_verified"] = True
        return user

    assert db is not None
    user.is_verified = True
    await db.commit()
    await db.refresh(user)
    return user


async def create_password_reset(db: AsyncSession | None, email: str) -> str | None:
    user = await find_user_by_email(db, email)
    if not user:
        return None

    user_id = user["id"] if isinstance(user, dict) else user.id
    token = secrets.token_urlsafe(32)
    await store_one_time_token(
        db,
        user_id,
        token,
        "reset_password",
        RESET_TOKEN_TTL,
    )
    await send_password_reset_email(normalize_email(email), token)
    return token


async def reset_password(db: AsyncSession | None, token: str, password: str) -> None:
    user_id = await consume_one_time_token(db, token, "reset_password")
    if not user_id:
        raise auth_error("Reset link is invalid or expired.", status.HTTP_400_BAD_REQUEST)

    user = await find_user_by_id(db, user_id)
    if not user:
        raise auth_error("Account no longer exists.", status.HTTP_404_NOT_FOUND)

    password_hash = hash_password(password)
    if isinstance(user, dict):
        user["password_hash"] = password_hash
        _tokens_valid_after_by_user[user_id] = int(time.time() * 1000)
        return

    assert db is not None
    user.password_hash = password_hash
    await invalidate_user_tokens(db, user_id)
    await db.commit()


async def update_profile(
    db: AsyncSession | None,
    user: User | dict[str, Any],
    request: ProfileUpdateRequest,
) -> User | dict[str, Any]:
    updates = request.model_dump(exclude_unset=True)
    if isinstance(user, dict):
        user.update(
            {
                key: value
                for key, value in updates.items()
                if value is not None or key in CLEARABLE_PROFILE_FIELDS
            }
        )
        user["profile_completed"] = True
        return user

    for key, value in updates.items():
        if value is not None or key in CLEARABLE_PROFILE_FIELDS:
            setattr(user, key, value)
    assert db is not None
    user.profile_completed = True
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_from_token(db: AsyncSession | None, token: str) -> User | dict[str, Any]:
    payload = decode_jwt(token)
    if await is_token_revoked(db, str(payload["jti"])):
        raise auth_error("Token has been revoked")

    user_id = str(payload.get("sub") or "")
    if not await is_user_token_current(db, user_id, int(payload["iat_ms"])):
        raise auth_error("Token is no longer valid")
    user = await find_user_by_id(db, user_id)
    if not user:
        raise auth_error("User not found", status.HTTP_404_NOT_FOUND)
    return user


async def revoke_token(db: AsyncSession | None, token: str) -> None:
    payload = decode_jwt(token)
    token_id = str(payload["jti"])
    expires_at = datetime.fromtimestamp(int(payload["exp"]), timezone.utc)
    if db is None:
        _revoked_token_ids[token_id] = int(payload["exp"])
        return

    existing = await db.get(RevokedAccessToken, token_id)
    if existing is None:
        db.add(RevokedAccessToken(token_id=token_id, expires_at=expires_at))
    else:
        existing.expires_at = expires_at
    await db.commit()


async def store_one_time_token(
    db: AsyncSession | None,
    user_id: str,
    token: str,
    purpose: Literal["verify_email", "reset_password"],
    ttl_seconds: int,
) -> None:
    token_hash = hash_one_time_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    if db is None:
        target = _verification_tokens if purpose == "verify_email" else _reset_tokens
        stale_hashes = [
            stored_hash
            for stored_hash, (stored_user_id, _) in target.items()
            if stored_user_id == user_id
        ]
        for stored_hash in stale_hashes:
            target.pop(stored_hash, None)
        target[token_hash] = (user_id, int(expires_at.timestamp()))
        return

    await db.execute(
        delete(AuthOneTimeToken).where(
            AuthOneTimeToken.user_id == user_id,
            AuthOneTimeToken.purpose == purpose,
            AuthOneTimeToken.consumed_at.is_(None),
        )
    )
    db.add(
        AuthOneTimeToken(
            id=str(uuid.uuid4()),
            user_id=user_id,
            token_hash=token_hash,
            purpose=purpose,
            expires_at=expires_at,
        )
    )
    await db.commit()


async def consume_one_time_token(
    db: AsyncSession | None,
    token: str,
    purpose: Literal["verify_email", "reset_password"],
) -> str | None:
    token_hash = hash_one_time_token(token)
    now = datetime.now(timezone.utc)
    if db is None:
        target = _verification_tokens if purpose == "verify_email" else _reset_tokens
        token_data = target.pop(token_hash, None)
        if not token_data:
            return None
        user_id, expires_at = token_data
        return user_id if expires_at >= int(now.timestamp()) else None

    result = await db.execute(
        select(AuthOneTimeToken)
        .where(
            AuthOneTimeToken.token_hash == token_hash,
            AuthOneTimeToken.purpose == purpose,
            AuthOneTimeToken.consumed_at.is_(None),
        )
        .with_for_update()
    )
    stored_token = result.scalar_one_or_none()
    if stored_token is None or stored_token.expires_at < now:
        return None
    stored_token.consumed_at = now
    await db.flush()
    return stored_token.user_id


async def is_token_revoked(db: AsyncSession | None, token_id: str) -> bool:
    now = int(time.time())
    if db is None:
        stale = [
            revoked_id
            for revoked_id, expires_at in _revoked_token_ids.items()
            if expires_at < now
        ]
        for revoked_id in stale:
            _revoked_token_ids.pop(revoked_id, None)
        return token_id in _revoked_token_ids

    result = await db.execute(
        select(RevokedAccessToken.token_id).where(
            RevokedAccessToken.token_id == token_id,
            RevokedAccessToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar_one_or_none() is not None


async def invalidate_user_tokens(db: AsyncSession, user_id: str) -> None:
    valid_after = int(time.time() * 1000)
    state = await db.get(UserAuthState, user_id)
    if state is None:
        db.add(
            UserAuthState(
                user_id=user_id,
                tokens_valid_after_ms=valid_after,
            )
        )
    else:
        state.tokens_valid_after_ms = valid_after


async def is_user_token_current(
    db: AsyncSession | None,
    user_id: str,
    issued_at_ms: int,
) -> bool:
    if db is None:
        valid_after = _tokens_valid_after_by_user.get(user_id, 0)
        return issued_at_ms > valid_after

    state = await db.get(UserAuthState, user_id)
    return state is None or issued_at_ms > state.tokens_valid_after_ms


async def cleanup_auth_security_records() -> None:
    import database

    if not database.init_database() or database.AsyncSessionLocal is None:
        return
    now = datetime.now(timezone.utc)
    async with database.AsyncSessionLocal() as db:
        await db.execute(
            delete(AuthOneTimeToken).where(
                (AuthOneTimeToken.expires_at < now)
                | (AuthOneTimeToken.consumed_at.is_not(None))
            )
        )
        await db.execute(
            delete(RevokedAccessToken).where(RevokedAccessToken.expires_at < now)
        )
        await db.commit()


def oauth_not_configured(provider: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"{provider.title()} OAuth is not configured yet. Add client credentials to enable it.",
    )
