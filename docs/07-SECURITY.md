# Security and Privacy Baseline

## Authentication
- Use Argon2id or bcrypt with suitable work factor; NEVER plain text/MD5.
- Opaque session identifier in secure HttpOnly cookies; Rotate on login; invalidate on logout; expired sessions rejected server side.
- Rate-limit login/register; generic invalid-credential response; avoid user enumeration.
- Admin role guarded on backend; object ownership guard on `/orders/{id}`, `/cart`, `/addresses`.

## Request protection
- Input validation DTO whitelist, max string length, no trusting price/stock from client.
- CSRF protection on cookie-authenticated state changes; SameSite alone insufficient for some deployment topologies.
- CORS exact allowlist; no `*` with credentials; HTTPS outside localhost.
- SQL via Prisma parameterized queries; avoid raw dynamic SQL.
- Cloudinary upload: only authenticated `ADMIN` requests with a valid CSRF token can enter multipart parsing. The service accepts one JPEG/PNG/WebP up to 8 MB, verifies both MIME and magic bytes, disables caller-controlled filenames/overwrites, stores it in a purpose-scoped Cloudinary folder, and never writes it to the API container. Cloudinary API secrets remain server-only. SVG, GIF, arbitrary resource type, and client-supplied destination folders are rejected. Cloudinary account moderation/malware-retention settings remain an operational responsibility.

## Sensitive data
- Store minimal address/contact; mask PII in logs; do not log cookies/passwords/auth headers.
- `.env` and secrets excluded from Git; only `.env.example` checked in.
- Production DB user with least privileges; periodic backup & restore test (infrastructure production excluded from this phase).
- Do not store card information; payment provider handles it.

## API and operations checks
- Response error does not include Prisma queries, stack traces, password hashes.
- Request id correlation, failed-auth audit, basic dependency scanning.
- Check dependencies and licenses before shipping; review security advisory updates.
- Test: role bypass, IDOR, duplicate checkout, negative quantity, race condition, session fixation, CSRF.

## Implemented auth controls
- Passwords are hashed with bcrypt cost 12; password hashes and session tokens are never returned by the API.
- A 32-byte opaque random token is only sent in the `HttpOnly` cookie. The database stores its SHA-256 hash and seven-day expiry, not the raw token.
- Successful login removes the user's prior sessions before creating a new one. Expired sessions are rejected and removed on `GET /auth/me`.
- Current dev topology uses `SameSite=Lax` and exact CORS origin. Do not treat a session cookie alone as authorization to add unsafe mutations.
- Cart, address, checkout, cancellation, and logout mutations require a double-submit CSRF token: login sets readable `bookstore_csrf`, and the browser sends the matching `X-CSRF-Token`. The API also rejects browser requests whose `Origin` differs from `CORS_ORIGIN`.
