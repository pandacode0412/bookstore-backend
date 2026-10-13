# AGENTS.md — Backend (instructions for code assistants)

## Identity and boundaries
You are working in `bookstore-backend`: NestJS **Modular Monolith**, TypeScript, Prisma, PostgreSQL, REST JSON. `bookstore-frontend` is a separate sibling repo. No microservices, no infrastructure aside from dev Docker Compose. **This repo is a starter, NOT a completed e-commerce app.**

## Read first (in exact order)
1. `AI_CONTEXT.md`
2. `docs/README.md` → `docs/01-PRD.md` → `docs/02-SRS.md`
3. `docs/03-ARCHITECTURE.md`, `docs/04-DATABASE.md`, `docs/06-BUSINESS-FLOWS.md`
4. `docs/05-API.md`, `contracts/openapi.yaml`, `docs/07-SECURITY.md`
5. Existing source and any relevant `docs/08-TEST-PLAN.md` cases.

## Rules for modifications
- Keep module ownership and a single DB transaction for order+stock writes.
- No price/stock from client is authoritative. Preserve order item snapshots. Reject oversell.
- Auth and ownership are backend-enforced. Never log passwordHash/session tokens/PII.
- New API/field: update OpenAPI + Swagger metadata + documentation + tests in the same change. Never leave a code change undocumented; if no documentation is affected, state why in the hand-off.
- New DB model: update Prisma + DB doc + migration notes. Never destructively reset DB without explicit approval.
- Prefer safe and idempotent workflows, DTO validation, guarded status transitions.
- Don't add Kafka/Redis/microservices unless product requirements explicitly change.
- `docker-compose.yml` is for **development only**, not production.
- Don't mark incomplete specs as implemented; describe tests actually run.

## Expected answer format when completing a task
1. Scope & related FR/AC ids; 2. Files changed; 3. Command/tests executed and outcomes; 4. Unfinished risks/next tasks; 5. API/DB contract compatibility impact.

## Current starter features
- Implemented: GET `/api/health`, GET `/api/books?page&limit&q`, GET `/api/books/:slug`, seed demo.
- Planned (not implemented): auth, cart, checkout/orders, inventory transactions, admin, payments.

## Entry points
`src/main.ts`, `src/app.module.ts`, `src/modules/books/`, `prisma/schema.prisma`, `docker-compose.yml`.
