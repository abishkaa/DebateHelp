import os
import secrets
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Request, status

from models.validation import clean_email


@dataclass(frozen=True)
class OAuthProvider:
    id: str
    display_name: str
    client_id_env: str
    client_secret_env: str
    authorize_url: str
    token_url: str
    scopes: tuple[str, ...]


PROVIDERS = {
    "google": OAuthProvider(
        id="google",
        display_name="Google",
        client_id_env="GOOGLE_CLIENT_ID",
        client_secret_env="GOOGLE_CLIENT_SECRET",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        scopes=("openid", "email", "profile"),
    ),
    "github": OAuthProvider(
        id="github",
        display_name="GitHub",
        client_id_env="GITHUB_CLIENT_ID",
        client_secret_env="GITHUB_CLIENT_SECRET",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        scopes=("read:user", "user:email"),
    ),
}


def normalize_provider(provider: str) -> str:
    normalized = provider.strip().lower()
    if normalized not in PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unsupported sign-in provider.",
        )
    return normalized


def provider_display_name(provider: str) -> str:
    return PROVIDERS[normalize_provider(provider)].display_name


def provider_credentials(provider: str) -> tuple[OAuthProvider, str, str]:
    config = PROVIDERS[normalize_provider(provider)]
    client_id = os.getenv(config.client_id_env, "").strip()
    client_secret = os.getenv(config.client_secret_env, "").strip()
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                f"{config.display_name} sign-in is not configured yet. "
                f"Set {config.client_id_env} and {config.client_secret_env}."
            ),
        )
    return config, client_id, client_secret


def build_state() -> str:
    return secrets.token_urlsafe(32)


def external_base_url(request: Request) -> str:
    configured = (
        os.getenv("OAUTH_REDIRECT_BASE_URL", "").strip()
        or os.getenv("FRONTEND_URL", "").strip()
    )
    if configured:
        return configured.rstrip("/")

    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip()
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",", 1)[0].strip()
    scheme = forwarded_proto or request.url.scheme
    host = forwarded_host or request.headers.get("host") or request.url.netloc
    return f"{scheme}://{host}".rstrip("/")


def oauth_redirect_uri(request: Request, provider: str) -> str:
    normalized = normalize_provider(provider)
    return f"{external_base_url(request)}/auth/oauth/{normalized}/callback"


def build_authorization_url(provider: str, state: str, redirect_uri: str) -> str:
    config, client_id, _ = provider_credentials(provider)
    query = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(config.scopes),
        "state": state,
    }
    if config.id == "google":
        query["access_type"] = "offline"
        query["prompt"] = "select_account"
    return f"{config.authorize_url}?{urlencode(query)}"


async def exchange_code_for_profile(
    provider: str,
    code: str,
    redirect_uri: str,
) -> dict[str, Any]:
    normalized = normalize_provider(provider)
    config, client_id, client_secret = provider_credentials(normalized)
    token_data = await exchange_code_for_token(config, client_id, client_secret, code, redirect_uri)
    access_token = str(token_data.get("access_token") or "")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{config.display_name} did not return an access token.",
        )

    if normalized == "google":
        return await fetch_google_profile(access_token)
    if normalized == "github":
        return await fetch_github_profile(access_token)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unsupported provider.")


async def exchange_code_for_token(
    config: OAuthProvider,
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            config.token_url,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{config.display_name} sign-in failed while exchanging the authorization code.",
        )
    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{config.display_name} returned an unreadable sign-in response.",
        ) from exc
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{config.display_name} returned an unexpected sign-in response.",
        )
    return data


async def fetch_google_profile(access_token: str) -> dict[str, Any]:
    data = await get_json(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        access_token,
        "Google",
    )
    email = normalize_profile_email(data.get("email"), "Google")
    if data.get("email_verified") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google did not confirm this email address.",
        )
    return {
        "provider": "google",
        "email": email,
        "full_name": data.get("name") or email.split("@", 1)[0],
        "profile_image_url": data.get("picture"),
        "email_verified": True,
    }


async def fetch_github_profile(access_token: str) -> dict[str, Any]:
    user = await get_json("https://api.github.com/user", access_token, "GitHub")
    emails = await get_json("https://api.github.com/user/emails", access_token, "GitHub")
    primary_email = None
    if isinstance(emails, list):
        verified_emails = [
            item
            for item in emails
            if isinstance(item, dict) and item.get("email") and item.get("verified")
        ]
        primary_email = next(
            (item.get("email") for item in verified_emails if item.get("primary")),
            None,
        ) or (verified_emails[0].get("email") if verified_emails else None)

    email = normalize_profile_email(primary_email or user.get("email"), "GitHub")
    return {
        "provider": "github",
        "email": email,
        "full_name": user.get("name") or user.get("login") or email.split("@", 1)[0],
        "profile_image_url": user.get("avatar_url"),
        "email_verified": True,
    }


async def get_json(url: str, access_token: str, provider_name: str) -> Any:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            url,
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider_name} sign-in failed while loading your profile.",
        )
    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider_name} returned an unreadable profile response.",
        ) from exc


def normalize_profile_email(value: Any, provider_name: str) -> str:
    try:
        return clean_email(str(value or ""))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{provider_name} did not share a verified email address.",
        ) from exc
