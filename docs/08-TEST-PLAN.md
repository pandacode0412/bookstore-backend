# Test Plan / Test Cases

## Test layers
- Unit: pricing, state transitions, validation, authorization rules.
- Integration: NestJS + test DB, Prisma transaction rollback, concurrency, idempotency.
- API contract: OpenAPI schema and negative responses.
- E2E: Next.js storefront → checkout COD → admin transitions.
- Manual: accessibility, responsive mobile/desktop, admin usability.

## Cases
| ID | Scenario | Expected |
|---|---|---|
| TC-001 | GET books with `page=1&limit=12` | 200, metadata and published books only |
| TC-002 | Search by title `q=clean` | Correct matching items |
| TC-003 | Register duplicate email ignoring case | 409 |
| TC-004 | Login bad password | 401, no session |
| TC-005 | Guest calls POST /orders | 401 |
| TC-006 | CUSTOMER calls admin route | 403 |
| TC-007 | Customer A fetches Customer B order | 403/404, no PII |
| TC-008 | Cart quantity=0 / 100 | 400/422 |
| TC-009 | Checkout 2 copies with stock=1 | no order, stock unchanged |
| TC-010 | Two concurrent checkout stock=1 | exactly one success, stock=0 |
| TC-011 | Retry identical Idempotency-Key | exactly one order |
| TC-012 | Same key different payload | 409 |
| TC-013 | Cancel Pending order twice | stock restored exactly once |
| TC-014 | Attempt PENDING → SHIPPING | 409/422 |
| TC-015 | Change book price after order | order snapshot unchanged |
| TC-016 | Admin adjust stock negative final | rejected, invariant stock>=0 |
| TC-017 | DB error during create order | rollback everything |
| TC-018 | Product status DRAFT / ARCHIVED | not public catalog |
| TC-019 | UI at 360px and 1440px | no overflow; usable controls |
| TC-020 | CSRF attack on cookie endpoint | rejected |

## Release gate
- P0 AC tested and green, lint/typecheck/test commands pass, API contracts reviewed.
- E2E COD flow verified against DB and UI.
- Existing starter cannot be declared MVP-complete until business endpoints are implemented and tests green.

## Running available starter checks
- `curl http://localhost:4000/api/health`
- `curl http://localhost:4000/api/books`
- Docker Compose `ps` shows postgres healthy and services running.

## Implemented catalog unit checks
- `npm test` builds the backend then runs catalog and Swagger-document checks with Node's built-in test runner.
- It verifies query construction for title/category/base-price sorting, rejects invalid public query values, verifies the public category visibility condition, and verifies the generated Swagger route/cookie-security metadata.
- API-level catalog checks and database-backed integration tests remain part of QA-001.

## Implemented auth checks
- The required local Compose smoke sequence is: register, duplicate email (`409`), bad login (`401`), successful login (`200` + `Set-Cookie`), cookie-backed `me` (`200`), logout (`204`), then `me` (`401`).
- `test/auth.service.test.mjs` verifies email normalization, bcrypt hashing, generic invalid credentials, session rotation, and that only the SHA-256 token hash is persisted.
- Database integration cases (including the Compose smoke sequence, rate limiting, and CSRF behavior for future authenticated mutations) remain part of QA-001/SEC-001.

## Implemented wishlist checks

- `test/wishlist.service.test.mjs` verifies owner-scoped listing/removal, UUID validation, published-book validation, and idempotent save behavior.

## Implemented ADMIN dashboard checks

- `test/admin.service.test.mjs` verifies the derived counts, delivered-only revenue, zero-filled order statuses, and safe customer-name fallback for a recent order.
- Swagger route verification includes `GET /api/admin/dashboard`; manual/API smoke testing must still check `401` without a session and `403` for a CUSTOMER session.

## Implemented CSRF cookie check

- Login/register issue the readable CSRF cookie at `/`, not `/api`, so a frontend route can read it and send the matching header for logout, cart, wishlist, address, and order mutations. Session cookies remain HttpOnly and scoped to `/api`.

## Implemented cart checks
- Swagger-document verification ensures all cart routes are published alongside implemented catalog/auth routes.
- Database-backed cart ownership, stale-stock, and CSRF integration tests remain part of QA-001/SEC-001; checkout must add concurrency testing before it is implemented.

## Implemented checkout coverage and remaining QA
- Swagger-document verification now asserts that saved-address and customer-order routes are published with the backend implementation.
- Unit tests cover server-price snapshot, conditional stock decrement, inventory-movement/cart-clear writes, and PENDING cancellation's conditional restock behavior.
- Integration follow-up must exercise a real PostgreSQL database for TC-009 through TC-013, especially two concurrent serializable transactions on the last copy. The code uses conditional stock decrements and a serializable transaction, but this repository's current lightweight test runner has no disposable PostgreSQL service.
