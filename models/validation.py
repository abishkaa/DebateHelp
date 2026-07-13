import base64
import binascii
import re
import unicodedata
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SESSION_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
ROOM_CODE_RE = re.compile(r"^[A-Z0-9]{4,16}$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9._~-]+$")
PROFILE_IMAGE_DATA_URL_RE = re.compile(r"^data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$")
MAX_PROFILE_IMAGE_DATA_URL_LENGTH = 80_000
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
    if not value.strip():
        return None
    return clean_text(value)


def clean_password(value: str) -> str:
    _reject_unsafe_characters(value)
    if not value or value.isspace():
        raise ValueError("Password cannot be blank")
    return value


def clean_new_password(value: str) -> str:
    password = clean_password(value)
    lowered = password.lower()
    if len(password) < 8:
        raise ValueError("Use at least 8 characters")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValueError("Use at least one letter and one number")
    if lowered in {"password", "password1", "password123", "debatehelp", "letmein123"}:
        raise ValueError("Choose a less common password")
    return password


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


def clean_room_code(value: str) -> str:
    room_code = clean_text(value).upper().replace(" ", "").replace("-", "")
    if not ROOM_CODE_RE.fullmatch(room_code):
        raise ValueError("Room code can only contain 4-16 letters and numbers")
    return room_code


def clean_http_url(value: str | None) -> str | None:
    if value is None:
        return None
    if not value.strip():
        return None
    url = clean_text(value)
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid HTTP or HTTPS URL")
    if parsed.username or parsed.password:
        raise ValueError("URLs containing credentials are not allowed")
    return url


def clean_profile_image_url(value: str | None) -> str | None:
    if value is None:
        return None
    if not value.strip():
        return None
    image_url = clean_text(value)
    if image_url.startswith("data:"):
        if len(image_url) > MAX_PROFILE_IMAGE_DATA_URL_LENGTH:
            raise ValueError("Profile image is too large")
        if not PROFILE_IMAGE_DATA_URL_RE.fullmatch(image_url):
            raise ValueError("Profile image must be a JPG, PNG, or WebP image")
        media_type, encoded = image_url.split(",", 1)
        try:
            image_bytes = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Profile image is malformed") from exc
        if len(image_bytes) > 48_000:
            raise ValueError("Profile image is too large")
        if media_type == "data:image/jpeg;base64" and image_bytes.startswith(b"\xff\xd8\xff"):
            return image_url
        if media_type == "data:image/png;base64" and image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            return image_url
        if media_type == "data:image/webp;base64" and image_bytes.startswith(b"RIFF") and image_bytes[8:12] == b"WEBP":
            return image_url
        raise ValueError("Profile image content does not match its declared type")
    return clean_http_url(image_url)
