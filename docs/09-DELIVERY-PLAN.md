# Implementation Backlog / Milestones

## M0 — Foundation (starter included)
- [x] Two repo layout and starter apps
- [x] Docs PRD/SRS/arch/database/API + AI agents instructions
- [x] Compose local dev example with PostgreSQL + NestJS + Next.js
- [x] Initial Prisma models & seed demo books
- [ ] Run full Compose smoke test on Docker-enabled workstation

## M1 — Catalog / Auth
- [x] BE-001 Register/login/logout/me with opaque HttpOnly session persistence
- [~] BE-002 Admin category/book CRUD + validators — implemented; standalone author CRUD remains unneeded because book editing resolves controlled author names.
- [x] BE-003 Public book query paging/filter/detail (manual/typecheck verification; automated API tests remain QA-001)
- [x] FE-001 Storefront search/filter/detail + loading/empty/error states (manual/typecheck verification; E2E remains QA-002)
- [x] FE-002 Login/register UI/session-aware navigation

## M2 — Cart / Checkout
- [x] BE-004 Cart endpoints/ownership/quantity constraints + CSRF-protected mutations
- [ ] BE-005 COD checkout atomic transaction, idempotency, snapshots
- [ ] BE-006 Customer orders history/detail/cancel
- [ ] FE-003 Cart + checkout + address + success/history

## M3 — Admin / Inventory
- [ ] BE-007 Order transitions/cancel restore and status audit
- [ ] BE-008 Manual inventory adjustments + movements
- [x] BE-009 Admin summary stats — delivered metrics, status counts, newest orders, customer count and delivered-order top sellers.
- [x] FE-004 Admin books/categories/orders/dashboard — isolated responsive admin shell and real category/book/banner/order/customer modules implemented.

## M4 — Harden / Release
- [ ] SEC-001 CSRF/CORS/session security, rate limits and abuse checks
- [ ] QA-001 Integration concurrency/idempotency/ownership tests
- [ ] QA-002 E2E customer/admin happy and negative paths
- [ ] DX-001 Committed migrations and local data reset guide

## Definition of Ready
Task links FR/AC, affected API/schema/UI, examples, required tests, no unresolved blocking decision.

## Definition of Done
Code + tests + docs + OpenAPI/schema updated, role/ownership/edge cases tested, no secrets, review accepted. UI manual responsive pass for visible pages.

## Estimate
4–8 sprints for one developer as a planning placeholder, not delivery commitment; estimate after breakdown/refinement.
