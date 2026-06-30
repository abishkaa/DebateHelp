# Security

## Implemented Controls

- Global and authentication-specific sliding-window rate limits.
- Redis-backed distributed limits required in production.
- 64 KB request-body cap and strict JSON content enforcement.
- Pydantic request models that reject extra, malformed, unsafe, and oversized values.
- HttpOnly, SameSite authentication cookies with origin-based CSRF protection.
- Hashed, expiring, single-use verification and password-reset tokens.
- Persistent logout revocation and invalidation of all sessions after password reset.
- PBKDF2-SHA256 password hashing with 600,000 iterations and automatic upgrades.
- Exact CORS origins, security response headers, and production-disabled API docs.
- Server-only API credentials loaded from ignored environment files.
- SMTP delivery required in production; development links may use console delivery.

## Production Requirements

- `ENV=production`
- A random `JWT_SECRET` containing at least 32 characters
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_COOKIE_SECURE=true`
- Explicit HTTPS values for `FRONTEND_URL` and `CORS_ORIGINS`
- `AUTH_EMAIL_DELIVERY=smtp` and the required `SMTP_*` settings
- `TRUSTED_PROXY_IPS` whenever `TRUST_PROXY_HEADERS=true`
- An exact `VITE_API_BASE_URL` supplied during the frontend build

## Audit Results

Audit completed June 25, 2026:

- Tracked source secret scan: clean
- High-confidence Git history secret scan: clean
- Frontend token-storage scan: clean
- `npm audit`: no known vulnerabilities
- `pip-audit`: no known vulnerabilities
- Pyright: zero errors
- Production frontend build: passed
- Desktop and mobile browser security smoke tests: passed

## Remaining Risks

- Multi-factor authentication and breached-password screening are not implemented.
- JWT signing-key rotation does not yet support multiple active keys or a `kid`.
- Database changes currently use SQLAlchemy `create_all`; production should adopt
  versioned migrations before schema changes become frequent.
- Development console email delivery prints one-time links and must never be enabled
  in production.
- OAuth routes intentionally return `501` until provider credentials and callback
  validation are implemented.
