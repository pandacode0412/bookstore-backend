# REST API Specification (v1.0)

**Base URL dev:** `http://localhost:4000/api`. **Machine contract:** `../contracts/openapi.yaml`. Public catalog/banner feed, session auth, cart, saved delivery addresses, customer COD orders, and the ADMIN dashboard/content operations below are implemented.

## Swagger (implemented endpoints)

After starting the API, use the interactive Swagger UI at `http://localhost:4000/api/docs`. Its generated documents are available at `/api/docs-json` and `/api/docs-yaml`. Swagger documents only endpoints currently implemented in code; `contracts/openapi.yaml` remains the canonical planned MVP contract and includes backlog endpoints.

## Implemented session authentication

- `POST /auth/register`: validates a normalized email, an optional 1–120 character name, and a 6–128 character password; creates the account, signs the customer in, and returns only the public user record. It sets the same session and CSRF cookies as login. Duplicate emails return `409`.
- `POST /auth/login`: verifies bcrypt password hashes, rotates existing sessions for that user, stores only a SHA-256 hash of a random opaque session token, and sets `bookstore_session` as an `HttpOnly`, `SameSite=Lax`, `/api` cookie. It returns a generic `401` for invalid credentials.
- `GET /auth/me`: obtains the public user record from a non-expired session cookie.
- `POST /auth/logout`: deletes the current server-side session and clears the cookie. The browser must use `credentials: 'include'`; tokens must never be stored in `localStorage`. The readable CSRF cookie uses path `/` so frontend pages can send its matching header, while the session cookie remains `HttpOnly` at `/api`.
- Session lifetime is seven days. `Secure` is enabled when `NODE_ENV=production`; HTTPS is required in production.

## Implemented cart

- `GET /cart` returns the authenticated user's persistent lines and a server-derived `estimatedSubtotalVnd` using the current effective book price.
- `POST /cart/items`, `PATCH /cart/items/{bookId}`, and `DELETE /cart/items/{bookId}` enforce session ownership, published/in-stock books, quantity `1..99`, and stock bounds. The client never sends a price.
- Authenticated mutations must send the `X-CSRF-Token` header matching the readable `bookstore_csrf` cookie issued at login. The frontend API wrapper does this automatically. Swagger/manual clients must first log in and copy the cookie value into the header.
- The total is an estimate only; checkout still must reprice and atomically revalidate stock.

## Implemented wishlist

- `GET /wishlist` returns the current customer's saved published books in most-recently-saved order.
- `POST /wishlist/items` accepts a published `bookId`; it is idempotent, so saving the same book again does not create a duplicate.
- `DELETE /wishlist/items/{bookId}` is also idempotent. Wishlist records are owner-scoped and all mutations require the same CSRF header/cookie pair as cart changes.

## Implemented delivery addresses and COD orders

- `GET /addresses` lists only the authenticated customer's saved addresses. `POST /addresses` saves an address; the first saved address becomes default and a newly requested default replaces the previous default. State changes require the CSRF header/cookie pair.
- `POST /orders` requires `addressId`, `paymentMethod: "COD"`, optional `note` (maximum 500 chars), and an `Idempotency-Key` UUID header. The address must belong to the session user. The client sends neither prices nor stock.
- Checkout is a single serializable database transaction: it reloads the cart/address, calculates effective prices, conditionally decrements each published book only when stock is sufficient, saves immutable order/item/address snapshots, writes `ORDER_PLACED` movements, creates an `UNPAID` COD payment, and clears the cart. Any failure rolls back the entire transaction.
- A retry with the same user/key/payload returns the original order; a changed payload with that key returns `409`. An idempotency key is scoped to its customer.
- `GET /orders/me` and `GET /orders/{id}` are owner-only. `POST /orders/{id}/cancel` allows only a `PENDING` order; its conditional transition creates one `ORDER_CANCELED` movement per line and restores stock. Repeating cancellation returns the already-cancelled order without another restore.

## Implemented ADMIN dashboard

- `GET /admin/dashboard` requires both a valid session and the `ADMIN` role at the backend; a signed-in customer receives `403` and never receives metrics.
- It is read-only and returns book counts, published low-stock count (published books with stock `<= 5`), order totals, status distribution, and the five newest orders.
- `deliveredRevenueVnd` is the sum of `totalVnd` only for `DELIVERED` orders. It is not projected revenue from pending, cancelled, or shipping orders.

## Implemented ADMIN operations

- `GET /admin/books` lets ADMIN list all statuses with server-side `page`, `limit`, `q`, `status`, and `categoryId` filters. `GET /admin/books/summary` returns live total/published/draft/archived/out-of-stock counts for the management UI; it is not derived from one paginated result. `GET /admin/books/{id}` returns one administrative record for the dedicated edit route. `POST /admin/books` and `PATCH /admin/books/{id}` create/edit a book, its ordered image URLs, authors, price/sale price, stock, category and status. SKU/slug/ISBN uniqueness, nonnegative integer VND/stock, sale-price limit, category UUID, URL shape and payload size are validated. There is no hard-delete route; use `ARCHIVED`.
- `POST /admin/media/images` is a multipart Cloudinary upload endpoint for ADMIN only. It requires the normal session and CSRF header before file parsing, accepts exactly one JPEG/PNG/WebP no larger than 8 MB, checks both declared MIME type and file signature, and returns a Cloudinary HTTPS URL. It accepts `purpose` `book-cover`, `book-gallery`, or `banner`; the API container keeps no copy. A `503` means the three Cloudinary environment variables are not configured.
- `GET/POST/PATCH /admin/banners` manages homepage carousel records. `GET /banners` is public and returns active records only in display order. It continues to accept an existing HTTPS or storefront-local URL, including the URL returned by the Cloudinary upload endpoint.
- `GET /admin/orders` supports paginated status/query filtering. `PATCH /admin/orders/{id}/status` requires CSRF and only permits `PENDING→CONFIRMED/CANCELED`, `CONFIRMED→PACKING/CANCELED`, `PACKING→SHIPPING/CANCELED`, and `SHIPPING→DELIVERED`. ADMIN cancellation atomically restores inventory and records actor/status history.
- `GET /admin/customers` is paginated/searchable and returns only id, name, email, creation time and order count. Password hashes, session records and addresses are never returned.

## Conventions
- JSON camelCase, ids UUID (book slug string), RFC3339/ISO 8601 timestamps UTC, amounts integer `VND`.
- Collections: `?page=1&limit=12`; response `{items:[...],meta:{page,limit,total,totalPages}}`.
- Success GET 200, POST create 201, DELETE 204, bad body 400/422, no session 401, role 403, missing 404, conflict 409, unexpected 500.
- Error: `{error:{code,message,details?},requestId}`; never expose stack traces.
- Session: `HttpOnly` cookie + CSRF mitigation on state-changing requests. Do not store tokens in localStorage.
- Media: Cloudinary credentials stay server-side. The frontend sends multipart `FormData` only to `/admin/media/images`, then submits the returned URL through the existing book/banner write contracts.
- `Idempotency-Key` required for `POST /orders`. Distinct client UUID per checkout attempt.

## Endpoint matrix
| Verb | Path | Auth | Purpose |
|---|---|---|---|
| GET | /health | Public | liveness |
| POST | /auth/register | Public | register |
| POST | /auth/login | Public | set session cookie |
| POST | /auth/logout | Customer/Admin | invalidate session |
| GET | /auth/me | Customer/Admin | profile |
| GET | /books | Public | Search title, filter category/on-sale, sort and paginate published books; `bestselling` counts DELIVERED quantities only |
| GET | /books/{slug} | Public | detail |
| GET | /categories | Public | Active categories, ordered by `sortOrder` then name; returns only id/name/slug |
| GET | /banners | Public | Active homepage banners, ordered by display order |
| GET | /admin/categories | Admin | List every category, including inactive and display order |
| POST | /admin/categories | Admin + CSRF | Create a category |
| PATCH | /admin/categories/{id} | Admin + CSRF | Edit name/slug, activate/deactivate, or change sort order |
| GET | /cart | Customer | cart + totals |
| POST | /cart/items | Customer | add/upsert |
| PATCH | /cart/items/{bookId} | Customer | quantity change |
| DELETE | /cart/items/{bookId} | Customer | remove |
| GET | /wishlist | Customer | saved books |
| POST | /wishlist/items | Customer | save a book |
| DELETE | /wishlist/items/{bookId} | Customer | remove a saved book |
| GET/POST | /addresses | Customer | list/save a delivery address |
| POST | /orders | Customer | create COD order |
| GET | /orders/me | Customer | my orders |
| GET | /orders/{id} | Owner/Admin | order detail |
| POST | /orders/{id}/cancel | Owner if pending | cancel |
| GET/POST | /admin/books | Admin | list/create books; list supports `q`, `status`, `categoryId`, pagination |
| GET | /admin/books/summary | Admin | live count summary for book management |
| GET/PATCH | /admin/books/{id} | Admin / Admin + CSRF | read/edit/archive one book, pricing, images/authors |
| GET/POST | /admin/banners | Admin | list/create carousel records |
| PATCH | /admin/banners/{id} | Admin + CSRF | edit/activate/reorder carousel record |
| POST | /admin/media/images | Admin + CSRF | Upload JPEG/PNG/WebP (max 8 MB) to Cloudinary and return its HTTPS URL |
| GET | /admin/orders | Admin | filter paginated orders |
| PATCH | /admin/orders/{id}/status | Admin + CSRF | valid transition + audit |
| GET | /admin/customers | Admin | customer-safe searchable directory |
| POST | /admin/inventory/adjustments | Admin | manual stock adjustment |
| GET | /admin/dashboard | Admin | implemented read-only totals, delivered revenue, status distribution and newest orders |

## Core schema examples
**GET /books**
```json
{"items":[{"id":"uuid","sku":"BK-001","slug":"clean-code","title":"Clean Code","priceVnd":220000,"salePriceVnd":199000,"coverUrl":"https://example.org/cover.jpg","stock":15,"status":"PUBLISHED"}],"meta":{"page":1,"limit":12,"total":1,"totalPages":1}}
```
**POST /cart/items**
```json
{"bookId":"uuid","quantity":2}
```
**POST /orders** (body does not contain prices)
```json
{"addressId":"uuid","paymentMethod":"COD","note":"Giao giờ hành chính"}
```
Header: `Idempotency-Key: <client-uuid>`. Result `201` `{id,orderCode,status,paymentStatus,subtotalVnd,shippingFeeVnd,totalVnd,addressSnapshot,items:[...]}`.

**PATCH /admin/orders/{id}/status**
```json
{"status":"CONFIRMED"}
```

## Validation & authorization
- UUID/schema/body whitelist; reject unknown fields if strict mode decided.
- 1 <= quantity <= 99; price never accepted from web client; same owner enforced on address/order.
- Search input trimmed, length <=100; page/limit max 50; category is a lowercase slug; sort whitelist includes `bestselling`; `onSale` accepts only literal `true`. Price sorting is by `priceVnd` (base price), with newest first to break ties. Bestselling ranking only sums quantities from `DELIVERED` orders, and promotion filtering only returns books with `salePriceVnd` configured.
- Admin operations require authenticated ADMIN; make 403 even if FE hides button.

## API lifecycle
1. Update OpenAPI, Swagger metadata, and docs; review breaking change. 2. Backend DTO/service + integration tests. 3. Frontend typed API client & error views. 4. E2E verify. Every code change must update applicable documentation in the same change.
