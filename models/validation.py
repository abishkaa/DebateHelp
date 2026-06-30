import re
import unicodedata
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SESSION_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9._~-]+$")
BIDI_CONTROL_CHARACTERS = {
    "\u061c",
    "\u200e",
    "\u200f",
    "\u202a",
    "\u202b",
    "\u202c",
    "\u202d",
    "\u202e",
    "\u2066",
    "\u2067",
    "\u2068",
    "\u2069",
}


class SecureRequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _reject_unsafe_characters(value: str, *, allow_multiline: bool = False) -> str:
    for character in value:
        if character in BIDI_CONTROL_CHARACTERS:
            raise ValueError("Field contains unsupported control characters")
        if unicodedata.category(character) in {"Cc", "Cs"}:
            if allow_multiline and character in {"\n", "\r", "\t"}:
                continue
            raise ValueError("Field contains unsupported control characters")
    return value


def clean_text(value: str, *, allow_multiline: bool = False) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    cleaned = _reject_unsafe_characters(
        normalized,
        allow_multiline=allow_multiline,
    ).strip()
    if not cleaned:
        raise ValueError("Field cannot be blank")
    return cleaned


def clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = clean_text(value)
    return cleaned or None


def clean_password(value: str) -> str:
    _reject_unsafe_characters(value)
    if not value or value.isspace():
        raise ValueError("Password cannot be blank")
    return value


def clean_email(value: str) -> str:
    email = clean_text(value).casefold()
    if not EMAIL_RE.fullmatch(email):
        raise ValueError("Enter a valid email address")
    return email


def clean_token(value: str) -> str:
    token = clean_text(value)
    if not TOKEN_RE.fullmatch(token):
        raise ValueError("Token is malformed")
    return token


def clean_session_id(value: str) -> str:
    session_id = clean_text(value)
    if len(session_id) > 120:
        raise ValueError("Session ID is too long")
    if not SESSION_ID_RE.fullmatch(session_id):
        raise ValueError("Session ID contains unsupported characters")
    return session_id


def clean_http_url(value: str | None) -> str | None:
    if value is None:
        return None
    url = clean_text(value)
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid HTTP or HTTPS URL")
    if parsed.username or parsed.password:
        raise ValueError("URLs containing credentials are not allowed")
    return url
