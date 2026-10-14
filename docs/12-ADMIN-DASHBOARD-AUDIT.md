# Admin Dashboard Audit & Delivery

## Audit before implementation

The repositories already shared one PostgreSQL database, cookie-session authentication, `ADMIN`/`CUSTOMER` roles, a public catalog, customer orders, and a read-only `GET /admin/dashboard`. Categories were already manageable by ADMIN. Missing capabilities were book CRUD, banner records/API, admin order operations, a customer-safe directory, an isolated admin shell, and an audit record for sensitive order transitions.

There was no file/object-storage provider, malware scanner, or public upload policy. Direct multipart upload is therefore deliberately **not** exposed: storing files in the API container would be non-durable and unsafe. Banner management accepts a validated HTTPS or storefront-local image URL; an upload endpoint can only be added after a storage provider, MIME/size limits, malware scanning, and ACL policy are approved.

## Delivered API and data model

- `Banner` stores carousel title, accessible alt text, image URL, destination, object position, active flag, and display order. `GET /banners` exposes active records only; admin mutations are `/admin/banners`.
- `BookImage` stores ordered optional images. ADMIN book create/update accepts controlled author names, images, price, sale price, stock, category and publication status; a stock change on an existing book also writes an `ADMIN_ADJUSTMENT` inventory movement with actor. Books are archived through status, never hard-deleted.
- `Category.description` is optional and admin-only; the storefront contract stays minimal (`id`, `name`, `slug`).
- `OrderStatusEvent` records ADMIN actor, old/new state, optional reason and time. Admin order transitions obey the documented state machine; cancellation restores stock and writes inventory movement atomically.
- `/admin/customers` returns a paginated, search-only customer view with no password hash, sessions, addresses, or other credentials.
- Dashboard adds `totalCustomers` and delivered-order-only top selling books. A revenue timeline is not exposed because the current reporting model has no timezone/range reporting contract.

## Promotion decision

There is no coupon/promotion entity in the current data model. The established `Book.salePriceVnd` is the sole promotion mechanism, so promotion management is intentionally part of Book Management rather than a second, conflicting discount engine.

## Local migration note

Development Compose applies these additive fields/tables with `prisma db push`. Before production, create and review a committed Prisma migration and deployment plan; do not use `db push` in production.
