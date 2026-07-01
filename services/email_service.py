import asyncio
import os
import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode

from backend_env import load_backend_env

load_backend_env()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
ENVIRONMENT = os.getenv("ENV", "development").lower()
AUTH_EMAIL_DELIVERY = os.getenv("AUTH_EMAIL_DELIVERY", "console").lower()
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").lower() in {"1", "true", "yes"}


def validate_email_configuration() -> None:
    if AUTH_EMAIL_DELIVERY not in {"console", "disabled", "smtp"}:
        raise RuntimeError("AUTH_EMAIL_DELIVERY must be console, disabled, or smtp.")
    if ENVIRONMENT == "production" and AUTH_EMAIL_DELIVERY == "console":
        raise RuntimeError("AUTH_EMAIL_DELIVERY cannot be console in production.")
    if (
        ENVIRONMENT == "production"
        and AUTH_EMAIL_DELIVERY == "disabled"
        and os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").lower() in {"1", "true", "yes"}
    ):
        raise RuntimeError(
            "AUTH_EMAIL_DELIVERY must be smtp when REQUIRE_EMAIL_VERIFICATION is enabled."
        )
    if AUTH_EMAIL_DELIVERY == "smtp":
        if not SMTP_HOST or not SMTP_FROM_EMAIL:
            raise RuntimeError("SMTP_HOST and SMTP_FROM_EMAIL are required for SMTP.")
        if SMTP_PORT <= 0 or SMTP_PORT > 65535:
            raise RuntimeError("SMTP_PORT must be between 1 and 65535.")
        if SMTP_USE_TLS and SMTP_USE_SSL:
            raise RuntimeError("Enable only one of SMTP_USE_TLS or SMTP_USE_SSL.")
        if bool(SMTP_USERNAME) != bool(SMTP_PASSWORD):
            raise RuntimeError(
                "SMTP_USERNAME and SMTP_PASSWORD must both be set or both be empty."
            )


def _deliver_development_link(kind: str, user_email: str, url: str) -> None:
    if AUTH_EMAIL_DELIVERY == "console" and ENVIRONMENT != "production":
        print(f"[auth email] {kind} for {user_email}: {url}")
        return
    if AUTH_EMAIL_DELIVERY == "disabled":
        return


def _send_smtp_message(user_email: str, subject: str, text: str) -> None:
    message = EmailMessage()
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = user_email
    message["Subject"] = subject
    message.set_content(text)

    client_type = smtplib.SMTP_SSL if SMTP_USE_SSL else smtplib.SMTP
    with client_type(SMTP_HOST, SMTP_PORT, timeout=15) as client:
        if SMTP_USE_TLS:
            client.starttls()
        if SMTP_USERNAME:
            client.login(SMTP_USERNAME, SMTP_PASSWORD)
        client.send_message(message)


async def _deliver_link(
    kind: str,
    user_email: str,
    url: str,
    subject: str,
) -> None:
    if AUTH_EMAIL_DELIVERY == "smtp":
        await asyncio.to_thread(
            _send_smtp_message,
            user_email,
            subject,
            f"{kind}: {url}\n\nIf you did not request this, you can ignore this email.",
        )
        return
    _deliver_development_link(kind, user_email, url)


async def send_verification_email(user_email: str, token: str) -> None:
    """Send a verification link through the configured auth email delivery mode."""
    query = urlencode({"token": token, "email": user_email})
    verification_url = f"{FRONTEND_URL}/verify-email?{query}"
    await _deliver_link(
        "Verification link",
        user_email,
        verification_url,
        "Verify your DebateHelp email",
    )


async def send_password_reset_email(user_email: str, token: str) -> None:
    """Send a password reset link through the configured auth email delivery mode."""
    query = urlencode({"reset_token": token, "email": user_email})
    reset_url = f"{FRONTEND_URL}/forgot-password?{query}"
    await _deliver_link(
        "Password reset link",
        user_email,
        reset_url,
        "Reset your DebateHelp password",
    )
