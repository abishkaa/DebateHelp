# DebateHelp Security Notes

This document describes the current production security controls and the remaining limitations. It does not claim DebateHelp is perfectly secure.

## Implemented controls

- HttpOnly cookie-based authentication with secure production cookie settings.
- Separate signed CSRF cookie and `X-CSRF-Token` header validation for cookie-authenticated state-changing requests.
- Origin/Referer validation for browser state-changing requests.
- Global, auth-specific, analysis, report, live-debate, team-invite, and product-write rate limits.
- Redis-backed distributed rate limiting required in production.
- Request-size caps and strict JSON enforcement for API write requests.
- Stronger new-password validation for signup and password reset while preserving compatibility for existing logins.
- PBKDF2-SHA256 password hashing with at least 600,000 iterations and automatic rehash upgrade.
- Generic signup, token, and OAuth configuration errors to reduce account/environment enumeration.
- Hashed, expiring, single-use verification and password-reset tokens.
- Logout token revocation and password-reset session invalidation.
- Strict room-code and session-id validation before resource lookups.
- Duplicate live-debate statement protection for accidental replay/retry submissions.
- Profile image data URL MIME and byte-signature validation for JPG, PNG, and WebP.
- Explicit CORS origin allowlist; Vercel preview/branch origins are not trusted automatically.
- API security headers, private cache controls for auth/product/chat/history responses, and production HSTS.
- Vercel frontend security headers and CSP compatible with current app assets.
- Production-disabled FastAPI docs/OpenAPI.
- Server-only provider credentials loaded from environment variables.

## Production requirements

Set these in production:

- `ENV=production`
- `JWT_SECRET` with at least 32 random characters
- Optional `CSRF_SECRET` with at least 32 random characters; if omitted, `JWT_SECRET` signs CSRF tokens
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=lax` or stricter unless cross-site auth is explicitly required
- Explicit HTTPS `FRONTEND_URL`
- Explicit HTTPS `CORS_ORIGINS`
- `AUTH_EMAIL_DELIVERY=smtp` when email verification/password reset email delivery is required
- Required `SMTP_*` settings for SMTP delivery
- Google/GitHub OAuth credentials only as server-side env vars when OAuth is enabled

Do not rely on automatic Vercel preview URLs for trusted credentialed origins. Add only intentional production/development origins to `CORS_ORIGINS`.

## Local setup

Run the frontend as usual:

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server auto-starts the local FastAPI backend and uses localhost CORS/CSRF-compatible defaults.

Run security checks locally:

```powershell
.\.venv\Scripts\python.exe tests\security_smoke.py
.\.venv\Scripts\python.exe -m compileall -q services models routers main.py database.py security.py tests\security_smoke.py
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt
cd frontend
npm audit --audit-level=moderate
npm run build
```

## Security smoke coverage

`tests/security_smoke.py` verifies:

- weak new passwords are rejected
- signup succeeds with a strong password
- duplicate signup uses generic non-enumerating wording
- CSRF cookie is issued
- missing CSRF token is rejected
- valid CSRF token is accepted
- cross-origin state-changing requests are rejected
- fake image data URLs are rejected by byte signature
- SQL-injection-shaped session IDs are rejected
- authentication rate limiting triggers

## Remaining risks and limitations

- MFA and breached-password screening are not implemented.
- JWT key rotation with multiple active signing keys and `kid` support is not implemented.
- CSRF uses signed double-submit cookies, not server-side per-request nonce storage.
- Team invitations are currently invite records, not expiring one-time accept tokens with a full accept flow.
- Database schema is still created with SQLAlchemy `create_all`; production should move to versioned migrations.
- Live debate rooms do not yet have automatic database-level expiration/cleanup jobs.
- Development console email delivery prints one-time links and must never be enabled in production.
- OAuth PKCE is not implemented for web-client flows; state validation and server-side secrets are enforced.
- Python dependency vulnerability scanning depends on `pip-audit` being available in the local environment.

## Manual deployment checklist

- Confirm the app is on the intended branch and reviewed before merging to `main`.
- Confirm production `CORS_ORIGINS` contains only trusted HTTPS origins.
- Confirm OAuth callback URLs exactly match production URLs in Google/GitHub consoles.
- Confirm `JWT_SECRET`/`CSRF_SECRET` are high entropy and not reused from examples.
- Confirm `REDIS_URL` is configured for production rate limits.
- Confirm `AUTH_COOKIE_SECURE=true` in production.
- Confirm SMTP credentials are set if verification/reset email is enabled.
- Run `tests/security_smoke.py`, backend compile, frontend build, npm audit, and pip-audit.
- Test login, logout, signup, OAuth, profile update, live debate, and report export manually after deploy.
