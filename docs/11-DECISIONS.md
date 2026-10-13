# ADRs and Open Questions

## ADR-001 — Two repositories / one monolith backend (accepted)
Reason: FE/BE ownership separation and independent workflows without cross-service distributed transaction complexity.

## ADR-002 — NestJS + Prisma + PostgreSQL (accepted)
Reason: modular DI and relational consistency for order/inventory.

## ADR-003 — Next.js UI only, no separate frontend DB (accepted)
Reason: business validation belongs to backend; Next API/route handlers should not duplicate core business logic.

## ADR-004 — COD only initially (accepted)
Reason: minimize payment risk while validating catalog→order workflow.

## ADR-005 — Stock deducted on order creation (accepted for MVP)
Reason: simple predictable no-oversell semantics. Needs cancel restoration, duplicate prevention.

## ADR-006 — Local Docker Compose in Backend repo (accepted)
Reason: keep 2 repos; Compose references sibling frontend path. `docker compose` development only.

## ADR-007 — Prisma 6.x for starter (accepted provisionally)
Use pinned `6.19.3` client/CLI (classic generator) for scaffold compatibility; revisit before actual product implementation and document migration plan; do not silently jump to Prisma 7/8 APIs.

## Open questions (default MVP assumptions)
1. Shipping fee default 30,000 VND fixed; need business confirmation.
2. Guest checkout? Default NO; customer logs in.
3. Multi-address? Default YES, snapshot on order.
4. Refund/returns? Out-of-scope MVP.
5. Image storage? Demo URL initially; persistent media storage TBD.
6. Sales report: Delivered only; refunds out-of-scope.
7. Admin account bootstrap: provide secure CLI/manual seed, not a hardcoded password.

## Change management
Record feature-impacting change as ADR-### with rationale + impact to PRD/SRS/API/schema/FE + migration considerations.
