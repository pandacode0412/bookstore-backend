# AI Context — Backend quick index

**Project:** Single-vendor physical bookstore / Vietnamese UI / COD-first.
**Repos:** `bookstore-backend` (this), `bookstore-frontend` (sibling).
**Topology:** Browser → Next.js → NestJS modular monolith → PostgreSQL.
**Local Compose:** `docker compose up --build` from backend repo, sibling FE dir required.
**Currency:** VND integer amounts. **Roles:** CUSTOMER / ADMIN. **Book status:** DRAFT/PUBLISHED/ARCHIVED.
**Order status:** PENDING → CONFIRMED → PACKING → SHIPPING → DELIVERED; cancel before shipping under restrictions.
**Stock:** decrement at COD order placement; restore on cancellation exactly once; atomic, idempotent; never trust FE price.
**Auth target:** secure HttpOnly session cookie, CSRF mitigation, ownership checks.
**Current implementation:** public health, category list, and book list/detail; session auth register/login/me/logout; persistent authenticated cart; saved delivery-address list/create; COD checkout plus customer order history/detail/cancel. Checkout reprices server-side, atomically decrements stock, snapshots items/address, creates inventory movements, clears the cart, and is idempotent. Admin operations remain backlog.
**Swagger:** implemented routes are documented interactively at `/api/docs` (generated JSON `/api/docs-json`, YAML `/api/docs-yaml`). Keep Swagger metadata, OpenAPI, and relevant Markdown docs in sync with code changes.

## Sources by authority
1. User-approved changes / explicit task
2. `docs/01-PRD.md` and `docs/02-SRS.md` product decisions
3. `contracts/openapi.yaml` public API planned contract
4. `prisma/schema.prisma` actual DB model
5. Source code (`src/`) actual behavior
6. Remaining documentation; update inconsistencies rather than hiding them.

## Recommended next task
Continue with catalog admin; cross-reference the SRS and acceptance cases. No overnight/background claim; report only changes really made.
