# PRD — Online Bookstore (v1.0)

**Status:** Approved baseline for implementation (design reference, not delivery proof)  
**Product type:** B2C, single merchant, sách vật lý, bán tại Việt Nam, giá VND.  
**Architecture:** Next.js frontend repo + NestJS modular monolith backend repo + PostgreSQL.  
**Languages:** Vietnamese UI; code/API English naming.

## 1. Problem / vision
Khách muốn duyệt danh mục sách, tìm và mua sách, biết giá, tồn kho và trạng thái đơn. Nhân viên/admin cần quản lý catalog, nhận đơn, xử lý giao và kiểm soát tồn kho với lịch sử thay đổi.

## 2. Goals / non-goals
**Goals:** Có catalog dễ tìm; checkout COD; khách theo dõi đơn; admin vận hành catalog/order/stock; tránh oversell; có bộ API contract nhất quán cho 2 repo.

**Non-goals (MVP):** Marketplace đa nhà bán, ebook/DRM, recommendation AI, subscription, loyalty, voucher phức tạp, tự động tích hợp hãng vận chuyển, đa kho, microservices, HA/production infrastructure, online payment production-ready.

## 3. Personas
- Guest: xem/tìm/lọc sách, cần đăng ký/đăng nhập để checkout bản MVP.
- Customer: thêm giỏ, địa chỉ, đặt COD, xem lịch sử và hủy nếu `PENDING`.
- Admin: thêm sách, nhập/điều chỉnh tồn, xác nhận/đóng gói/giao đơn, hủy hợp lệ, báo cáo đơn cơ bản.

## 4. In-scope feature priorities
| Epic | Feature | Priority | MVP |
|---|---|---|---|
| Identity | Register/login/logout/me; role Customer/Admin | P0 | Yes |
| Catalog | List/search/filter/sort/detail sách | P0 | Yes |
| Catalog management | Category/author/book CRUD; publish/archive | P0 | Yes |
| Cart | Add/change/remove item; persistent authenticated cart | P0 | Yes |
| Checkout | Address snapshot, server price, COD, order placement | P0 | Yes |
| Orders | Customer history/detail/cancel Pending | P0 | Yes |
| Admin orders | View, filter, transition status | P0 | Yes |
| Inventory | Atomic stock decrement at order; restore on cancel; audit movement | P0 | Yes |
| Admin reporting | Orders, sales, low-stock summary | P1 | Yes (basic) |
| Online payments | VNPay or MoMo verified callbacks | P2 | No |
| Promotions/reviews | Coupons, reviews, wishlists | P2 | No |

## 5. User journeys
1. Khách vào `/books` → filter → `/books/[slug]` → cart → login → checkout COD → success → `/account/orders`.
2. Admin `/admin/books` → create draft → add photo/price/stock → publish → catalog displays item.
3. Admin `/admin/orders` → CONFIRMED → PACKING → SHIPPING → DELIVERED; inventory has already been deducted when order created.

## 6. MVP success metrics
- E2E happy-path guest-to-COD-order / admin fulfillment chạy được.
- Không oversell khi có checkout cạnh tranh cùng SKU; thứ tự trạng thái hợp lệ.
- Không thấy trang admin/API admin khi không có quyền; không lộ password hash.
- Giá đặt hàng là giá server và lưu snapshot, kể cả sách đổi giá sau đó.

## 7. Constraints / assumptions
- Sách vật lý, 1 loại tiền VND, 1 kho, 1 đơn vị bán, 1 mức phí giao hàng cấu hình server (MVP có thể là 30.000₫ cố định).
- Chỉ COD trong MVP. Payment entity dự phòng future.
- Không tự động gửi email/SMS/shipper lúc đầu; status do admin cập nhật.
- Ảnh bìa demo dùng URL tĩnh; production media strategy là quyết định riêng.

## 8. Dependencies & risks
- Product/author/category relations và slug uniqueness.
- Concurrency checkout, duplicate requests, cancellation stock reversal.
- Quản trị nhận dữ liệu PII (tên, SĐT, địa chỉ): privacy/security.
- UI phải phân biệt giá bán, giá gốc và tình trạng hết hàng.

## 9. Acceptance / release gate
MVP chỉ DONE khi các scenario AC trong `02-SRS.md` và test cases trong `08-TEST-PLAN.md` vượt qua, docs/OpenAPI đồng bộ, và đã thử compose trên máy có Docker.
