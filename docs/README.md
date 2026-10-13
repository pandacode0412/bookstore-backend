# Bookstore Documentation Hub

## Tài liệu chuẩn (source of truth)

| File | Mô tả |
|---|---|
| `01-PRD.md` | Bài toán, mục tiêu, phạm vi MVP, yêu cầu sản phẩm |
| `02-SRS.md` | Functional requirements, precondition, edge cases, acceptance criteria |
| `03-ARCHITECTURE.md` | 2 repo, modular monolith, module boundaries, sequence |
| `04-DATABASE.md` | ERD, entity catalog, constraints, inventory logic |
| `05-API.md` | REST API contract, pagination, errors, auth, idempotency |
| `06-BUSINESS-FLOWS.md` | Checkout, order state machine, inventory, payment |
| `07-SECURITY.md` | Security checklist, auth, data protection |
| `08-TEST-PLAN.md` | Unit/integration/E2E/acceptance test cases |
| `09-DELIVERY-PLAN.md` | Milestones, tickets, definition of done |
| `10-OPERATIONS-DEV.md` | Docker Compose local dev, env, migrations, troubleshooting |
| `11-DECISIONS.md` | ADRs, assumptions, open questions |
| `../contracts/openapi.yaml` | Machine-readable API planned contract |
| `../prisma/schema.prisma` | Executable Prisma models |

### AI reading order
`../AGENTS.md` → `../AI_CONTEXT.md` → `01-PRD.md` → `02-SRS.md` → `03-ARCHITECTURE.md` → `04-DATABASE.md` → `05-API.md` → relevant task → code.

### State conventions
**SPEC** = ý định thiết kế; **STARTER** = đã có skeleton chạy; **DONE** chỉ sau khi có test và kiểm chứng. Khi docs và code khác nhau, đừng tự tuyên bố tính năng đã hoàn thành; cập nhật docs + code trong cùng thay đổi.
