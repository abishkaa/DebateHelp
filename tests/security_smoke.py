import os
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ.setdefault("ENV", "development")
os.environ.setdefault("JWT_SECRET", "test-secret-" + "x" * 64)
os.environ.setdefault("AUTH_EMAIL_DELIVERY", "disabled")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ["DATABASE_URL"] = ""

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
from main import app  # noqa: E402

database.DATABASE_URL = ""


ORIGIN = "http://localhost:5173"


def assert_status(response, expected_status: int, label: str) -> None:
    if response.status_code != expected_status:
        raise AssertionError(
            f"{label}: expected {expected_status}, got {response.status_code}: {response.text}"
        )


def signup_payload(email: str, password: str = "StrongPass123") -> dict[str, object]:
    return {
        "full_name": "Security Smoke",
        "email": email,
        "password": password,
        "confirm_password": password,
        "role": "Student",
        "purpose": "Security smoke testing",
    }


def main() -> None:
    unique = int(time.time() * 1000)
    email = f"security.smoke.{unique}@example.com"

    with TestClient(app) as client:
        weak = client.post(
            "/auth/signup",
            json=signup_payload(f"weak.{email}", "password"),
            headers={"Origin": ORIGIN},
        )
        assert_status(weak, 422, "weak password rejected")

        created = client.post(
            "/auth/signup",
            json=signup_payload(email),
            headers={"Origin": ORIGIN},
        )
        assert_status(created, 200, "signup succeeds")

        duplicate = client.post(
            "/auth/signup",
            json=signup_payload(email),
            headers={"Origin": ORIGIN, "X-CSRF-Token": client.cookies.get("debatehelp_csrf", "")},
        )
        assert_status(duplicate, 409, "duplicate signup rejected")
        if "already exists" in duplicate.text.lower():
            raise AssertionError("duplicate signup leaked account existence wording")

        csrf_token = client.cookies.get("debatehelp_csrf")
        if not csrf_token:
            raise AssertionError("signup did not issue csrf cookie")

        missing_csrf = client.post(
            "/auth/profile",
            json={"organization": "No CSRF"},
            headers={"Origin": ORIGIN},
        )
        assert_status(missing_csrf, 403, "missing csrf rejected")

        valid_csrf = client.post(
            "/auth/profile",
            json={"organization": "CSRF OK"},
            headers={"Origin": ORIGIN, "X-CSRF-Token": csrf_token},
        )
        assert_status(valid_csrf, 200, "valid csrf accepted")

        cross_origin = client.post(
            "/auth/profile",
            json={"organization": "Evil origin"},
            headers={"Origin": "https://evil.example", "X-CSRF-Token": csrf_token},
        )
        assert_status(cross_origin, 403, "cross-origin state change rejected")

        fake_png = client.post(
            "/auth/profile",
            json={
                "profile_image_url": "data:image/png;base64,"
                + "SGVsbG8sIG5vdCBhIHBuZyBmaWxlLg=="
            },
            headers={"Origin": ORIGIN, "X-CSRF-Token": csrf_token},
        )
        assert_status(fake_png, 422, "fake image upload rejected")

        attack_session = client.get(
            "/history/%27%20OR%201%3D1--",
            headers={"Origin": ORIGIN},
        )
        assert_status(attack_session, 422, "sql-injection shaped session id rejected")

        client.cookies.clear()
        bad_login_email = f"ratelimit.{email}"
        statuses = [
            client.post(
                "/auth/login",
                json={"email": bad_login_email, "password": "WrongPass123", "remember": False},
                headers={"Origin": ORIGIN},
            ).status_code
            for _ in range(6)
        ]
        if 429 not in statuses:
            raise AssertionError(f"auth rate limit did not trigger: {statuses}")

    print("security smoke passed")


if __name__ == "__main__":
    main()
