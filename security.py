import asyncio
import ipaddress
import math
import os
import secrets
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlsplit

import redis.asyncio as redis
from redis.exceptions import RedisError

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response


def _positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default)).strip()
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive integer.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer.")
    return value


GLOBAL_RATE_LIMIT = _positive_int("RATE_LIMIT_GLOBAL_MAX_REQUESTS", 300)
GLOBAL_RATE_WINDOW = _positive_int("RATE_LIMIT_GLOBAL_WINDOW_SECONDS", 900)
AUTH_RATE_LIMIT = _positive_int("AUTH_RATE_LIMIT_MAX_ATTEMPTS", 5)
AUTH_RATE_WINDOW = _positive_int("AUTH_RATE_LIMIT_WINDOW_SECONDS", 900)
MAX_REQUEST_BYTES = _positive_int("MAX_REQUEST_BYTES", 65_536)
TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "false").lower() in {
    "1",
    "true",
    "yes",
}
TRUSTED_PROXY_IPS = [
    value.strip()
    for value in os.getenv("TRUSTED_PROXY_IPS", "").split(",")
    if value.strip()
]
try:
    TRUSTED_PROXY_NETWORKS = [
        ipaddress.ip_network(value, strict=False)
        for value in TRUSTED_PROXY_IPS
    ]
except ValueError as exc:
    raise RuntimeError("TRUSTED_PROXY_IPS contains an invalid IP or CIDR.") from exc
AUTH_COOKIE_NAME = os.getenv("AUTH_COOKIE_NAME", "debatehelp_session")
REDIS_URL = os.getenv("REDIS_URL", "").strip()

SENSITIVE_AUTH_PATHS = {
    "/auth/signup",
    "/auth/login",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/auth/oauth/google",
    "/auth/oauth/github",
    "/auth/oauth/microsoft",
}


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_after: int


class RateLimiter(Protocol):
    async def hit(
        self,
        key: str,
        limit: int,
        window_seconds: int,
    ) -> RateLimitResult: ...


class RateLimiterUnavailable(RuntimeError):
    pass


class InMemoryRateLimiter:
    def __init__(self, max_keys: int = 10_000) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()
        self._max_keys = max_keys

    async def hit(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        now = time.monotonic()
        cutoff = now - window_seconds

        async with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= limit:
                reset_after = max(1, int(window_seconds - (now - events[0])) + 1)
                return RateLimitResult(False, limit, 0, reset_after)

            events.append(now)
            remaining = max(0, limit - len(events))
            reset_after = max(1, int(window_seconds - (now - events[0])) + 1)

            if len(self._events) > self._max_keys:
                self._remove_stale_keys(cutoff)

            return RateLimitResult(True, limit, remaining, reset_after)

    def _remove_stale_keys(self, cutoff: float) -> None:
        stale_keys = [
            key
            for key, events in self._events.items()
            if not events or events[-1] <= cutoff
        ]
        for key in stale_keys:
            self._events.pop(key, None)


class RedisRateLimiter:
    _SCRIPT = """
local current_time = redis.call('TIME')
local now_ms = (current_time[1] * 1000) + math.floor(current_time[2] / 1000)
local window_ms = tonumber(ARGV[2])
local cutoff = now_ms - window_ms

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', cutoff)
local count = redis.call('ZCARD', KEYS[1])

if count >= tonumber(ARGV[1]) then
    local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
    local reset_ms = window_ms
    if oldest[2] then
        reset_ms = math.max(1, window_ms - (now_ms - tonumber(oldest[2])))
    end
    return {0, count, reset_ms}
end

redis.call('ZADD', KEYS[1], now_ms, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window_ms)
count = count + 1
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local reset_ms = window_ms
if oldest[2] then
    reset_ms = math.max(1, window_ms - (now_ms - tonumber(oldest[2])))
end
return {1, count, reset_ms}
"""

    def __init__(self, url: str) -> None:
        self._client = redis.from_url(url, decode_responses=True)

    async def hit(
        self,
        key: str,
        limit: int,
        window_seconds: int,
    ) -> RateLimitResult:
        try:
            raw_result = await self._client.eval(
                self._SCRIPT,
                1,
                f"debatehelp:rate:{key}",
                limit,
                window_seconds * 1000,
                secrets.token_urlsafe(18),
            )
        except RedisError as exc:
            raise RateLimiterUnavailable("Rate limiter storage is unavailable.") from exc

        allowed = bool(int(raw_result[0]))
        count = int(raw_result[1])
        reset_after = max(1, math.ceil(int(raw_result[2]) / 1000))
        return RateLimitResult(
            allowed=allowed,
            limit=limit,
            remaining=max(0, limit - count),
            reset_after=reset_after,
        )

    async def ping(self) -> None:
        try:
            await self._client.ping()
        except RedisError as exc:
            raise RuntimeError("REDIS_URL is configured but Redis is unavailable.") from exc

    async def close(self) -> None:
        await self._client.aclose()


configured_limiter: RateLimiter = (
    RedisRateLimiter(REDIS_URL)
    if REDIS_URL
    else InMemoryRateLimiter()
)
request_limiter = configured_limiter
identifier_limiter = configured_limiter


async def validate_rate_limit_configuration() -> None:
    if TRUST_PROXY_HEADERS and not TRUSTED_PROXY_NETWORKS:
        raise RuntimeError(
            "TRUSTED_PROXY_IPS is required when TRUST_PROXY_HEADERS is enabled."
        )
    if os.getenv("ENV", "development").lower() == "production" and not REDIS_URL:
        raise RuntimeError("REDIS_URL is required for distributed production rate limiting.")
    if isinstance(configured_limiter, RedisRateLimiter):
        await configured_limiter.ping()


async def close_rate_limiter() -> None:
    if isinstance(configured_limiter, RedisRateLimiter):
        await configured_limiter.close()


def client_ip(request: Request) -> str:
    direct_ip = request.client.host if request.client else "unknown"
    trusted_proxy = False
    try:
        direct_address = ipaddress.ip_address(direct_ip)
        trusted_proxy = any(
            direct_address in network
            for network in TRUSTED_PROXY_NETWORKS
        )
    except ValueError:
        pass

    if TRUST_PROXY_HEADERS and trusted_proxy:
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        try:
            return str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
    return direct_ip


def _rate_headers(result: RateLimitResult) -> dict[str, str]:
    return {
        "RateLimit-Limit": str(result.limit),
        "RateLimit-Remaining": str(result.remaining),
        "RateLimit-Reset": str(result.reset_after),
    }


def _limited_response(result: RateLimitResult) -> JSONResponse:
    headers = _rate_headers(result)
    headers["Retry-After"] = str(result.reset_after)
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many requests. Try again later."},
        headers=headers,
    )


def normalize_origin(value: str) -> str:
    raw_value = value.strip().rstrip("/")
    if not raw_value:
        return ""
    if "://" not in raw_value:
        raw_value = f"https://{raw_value}"

    parsed = urlsplit(raw_value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""

    host = (parsed.hostname or "").lower()
    if not host:
        return ""

    port = f":{parsed.port}" if parsed.port is not None else ""
    return f"{parsed.scheme.lower()}://{host}{port}"


def configured_origin_values() -> set[str]:
    origins: set[str] = set()
    origins.update(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    )

    for env_name in (
        "FRONTEND_URL",
        "OAUTH_REDIRECT_BASE_URL",
        "VERCEL_URL",
        "VERCEL_BRANCH_URL",
        "VERCEL_PROJECT_PRODUCTION_URL",
    ):
        value = os.getenv(env_name, "").strip()
        if value:
            origins.add(value)
    return origins


def allowed_browser_origins() -> set[str]:
    origins: set[str] = set()
    if os.getenv("ENV", "development").lower() != "production":
        origins.update(
            {
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
            }
        )
    origins.update(configured_origin_values())
    return {
        normalized
        for origin in origins
        if (normalized := normalize_origin(origin))
    }


def request_origin(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip()
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",", 1)[0].strip()
    scheme = forwarded_proto or request.url.scheme
    host = forwarded_host or request.headers.get("host") or request.url.netloc
    return normalize_origin(f"{scheme}://{host}")


async def enforce_auth_identifier_limit(identifier: str, action: str) -> None:
    normalized = identifier.strip().casefold()
    try:
        result = await identifier_limiter.hit(
            f"auth:{action}:{normalized}",
            AUTH_RATE_LIMIT,
            AUTH_RATE_WINDOW,
        )
    except RateLimiterUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication protection is temporarily unavailable.",
        ) from exc
    if not result.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Try again later.",
            headers={
                **_rate_headers(result),
                "Retry-After": str(result.reset_after),
            },
        )


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method != "OPTIONS":
            csrf_error = self._validate_browser_origin(request)
            if csrf_error is not None:
                return self._secure(csrf_error, request.url.path)

            size_error = await self._validate_request_size(request)
            if size_error is not None:
                return self._secure(size_error, request.url.path)

            remote = client_ip(request)
            try:
                global_result = await request_limiter.hit(
                    f"global:{remote}",
                    GLOBAL_RATE_LIMIT,
                    GLOBAL_RATE_WINDOW,
                )
            except RateLimiterUnavailable:
                return self._secure(
                    JSONResponse(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        content={"detail": "Request protection is temporarily unavailable."},
                    ),
                    request.url.path,
                )
            if not global_result.allowed:
                return self._secure(_limited_response(global_result), request.url.path)

            selected_result = global_result
            if request.url.path in SENSITIVE_AUTH_PATHS:
                try:
                    auth_result = await request_limiter.hit(
                        f"auth-route:{request.url.path}:{remote}",
                        AUTH_RATE_LIMIT,
                        AUTH_RATE_WINDOW,
                    )
                except RateLimiterUnavailable:
                    return self._secure(
                        JSONResponse(
                            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            content={
                                "detail": "Authentication protection is temporarily unavailable."
                            },
                        ),
                        request.url.path,
                    )
                if not auth_result.allowed:
                    return self._secure(_limited_response(auth_result), request.url.path)
                selected_result = auth_result
        else:
            selected_result = None

        response = await call_next(request)
        if selected_result is not None:
            for name, value in _rate_headers(selected_result).items():
                response.headers[name] = value
        return self._secure(response, request.url.path)

    @staticmethod
    def _validate_browser_origin(request: Request) -> JSONResponse | None:
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return None
        if AUTH_COOKIE_NAME not in request.cookies:
            return None
        origin = normalize_origin(request.headers.get("origin", ""))
        allowed_origins = allowed_browser_origins()
        if origin and (
            origin == request_origin(request)
            or origin in allowed_origins
        ):
            return None
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Request origin is not allowed."},
        )

    async def _validate_request_size(self, request: Request) -> JSONResponse | None:
        content_encoding = request.headers.get("content-encoding", "identity").lower()
        if content_encoding not in {"", "identity"}:
            return JSONResponse(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                content={"detail": "Compressed request bodies are not accepted."},
            )

        content_length = request.headers.get("content-length")
        if content_length:
            try:
                declared_size = int(content_length)
            except ValueError:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "Invalid Content-Length header."},
                )
            if declared_size < 0:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "Invalid Content-Length header."},
                )
            if declared_size > MAX_REQUEST_BYTES:
                return JSONResponse(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    content={"detail": "Request body is too large."},
                )

        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            body = await request.body()
            if len(body) > MAX_REQUEST_BYTES:
                return JSONResponse(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    content={"detail": "Request body is too large."},
                )
            content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
            if body and content_type != "application/json":
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content={"detail": "Request body must use application/json."},
                )
        return None

    @staticmethod
    def _secure(response: Response, path: str) -> Response:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )
        if path.startswith("/auth"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        return response
