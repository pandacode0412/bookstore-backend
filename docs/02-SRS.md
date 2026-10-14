# SRS — Software Requirements (v1.0)

## Conventions
- `FR-*`: yêu cầu chức năng; `BR-*`: quy tắc nghiệp vụ; `AC-*`: kiểm tra nghiệm thu.
- P0 cần trước MVP release; P1 không chặn checkout core nếu đã được chấp thuận tách phase.
- Tất cả endpoint thay đổi dữ liệu cần validation, authentication theo role, lỗi nhất quán.

## 1. Identity (FR-AUTH)
**FR-AUTH-01 Register:** email hợp lệ/duy nhất (case-insensitive); mật khẩu tối thiểu 6 ký tự; không trả password hash. AC: email duplicate => `409`; weak password => `422` hoặc `400` theo OpenAPI.

**FR-AUTH-02 Login/logout:** credentials đúng phát hành session cookie HTTP-only; sai trả `401` thông báo chung; logout invalidate session. AC: cookie không còn hiệu lực sau logout.

**FR-AUTH-03 Roles:** CUSTOMER / ADMIN; Admin API luôn kiểm role tại server, không chỉ ẩn giao diện.

**FR-AUTH-04 Me:** `GET /api/auth/me` trả id, email, fullName, role; không có secret.

## 2. Book catalog (FR-CAT)
**FR-CAT-01 List:** chỉ `PUBLISHED` ở public; `page`, `limit`, `q`, `category`, `sort` (`newest`, `price_asc`, `price_desc`, `bestselling`) và `onSale=true`. Mặc định page=1, limit=12, limit<=50. `bestselling` chỉ cộng `OrderItem.quantity` của đơn `DELIVERED`, không tính giỏ hàng, đơn PENDING hoặc đơn bị hủy. `onSale=true` chỉ lấy sách có `salePriceVnd`. AC: empty => `{items:[], meta...}`.

**FR-CAT-02 Detail:** lấy theo slug; unpublished => public 404.

**FR-CAT-03 Book admin:** thêm/sửa/archive/đổi status, validate SKU/slug unique, giá VND >=0, giá giảm <= giá gốc, tồn kho không âm; nên không hard-delete sách từng được đặt.

**FR-CAT-04 Taxonomy:** Admin tạo/sửa category, đổi `sortOrder`, bật/tắt `isActive`; không hard-delete category có reference. `GET /categories` chỉ trả category active theo `sortOrder`, rồi `name`; response chỉ gồm `id`, `name`, `slug`. Admin xem tất cả category kể cả inactive tại `/admin/categories` và thay đổi dữ liệu qua session ADMIN + CSRF.

**FR-CAT-05 Admin content:** ADMIN quản lý sách (bao gồm status, gallery URL, tác giả và `salePriceVnd`), category và homepage banner. Không hard-delete sách đã có lịch sử; banner public chỉ trả active records. Upload file không nằm trong MVP khi chưa có object storage/quét tệp.

## 3. Cart (FR-CART)
**FR-CART-01:** chỉ Customer authenticated dùng giỏ persistent; một cart trên user; one line per book.

**FR-CART-02:** add quantity integer [1, 99]; upsert line; update/remove; catalog archived/unpublished/out-of-stock không được checkout.

**FR-CART-03:** tổng hiển thị chỉ là tham khảo; checkout phải reprice & revalidate tồn kho.

## 4. Checkout (FR-ORDER)
**FR-ORDER-01:** customer chọn địa chỉ đã sở hữu hoặc nhập recipient/name/phone/address; server snapshot vào Order; fee được tính server-side.

**FR-ORDER-02:** chấp nhận `POST /api/orders` với `Idempotency-Key` duy nhất theo customer và payload; yêu cầu trùng phải trả cùng kết quả; cùng key khác payload => conflict.

**FR-ORDER-03:** atomically kiểm tra tồn, giảm stock, ghi InventoryMovement, Order, OrderItem snapshots, clear giỏ; hoặc rollback tất cả.

**FR-ORDER-04:** chỉ COD MVP; order initial `PENDING`, payment `UNPAID`.

**FR-ORDER-05:** khách xem list/detail đơn mình; khách có thể cancel khi PENDING. Cancel thành công restore stock exactly once.

**FR-ORDER-06:** admin filter list/order detail và chuyển trạng thái với state machine ở `06-BUSINESS-FLOWS.md`.

**FR-ADMIN-01 Customer directory:** ADMIN có thể tìm kiếm customer-safe directory; không trả password hash, token, session, hoặc dữ liệu nhạy cảm không phục vụ vận hành.

## 5. Inventory (FR-INV)
**FR-INV-01:** admin tăng/giảm với reason, actor, change log; không cho giảm dưới 0.

**FR-INV-02:** bán hàng và hủy ghi movement có unique reference đảm bảo không double-apply.

**FR-INV-03:** low-stock admin summary threshold (mặc định 5, config sau).

## 6. Reports (FR-REP)
**FR-REP-01:** dashboard order count theo status, số sách low stock, revenue *đã giao* (DELIVERED) theo time range; ghi rõ quy tắc khi trả hàng/refund (ngoài MVP).

## 7. Non-functional requirements
| ID | Yêu cầu | Kiểm tra |
|---|---|---|
| NFR-01 | Responsive viewport 360px–desktop | UI smoke test |
| NFR-02 | API validation, consistent errors | Contract tests |
| NFR-03 | Role authorization; ownership | Negative auth tests |
| NFR-04 | Server-side prices; transaction consistency | Concurrency integration tests |
| NFR-05 | Pagination 1–50 | List API tests |
| NFR-06 | Accessible labels/keyboard forms | Manual a11y pass |
| NFR-07 | Sensitive logging sanitized | Log review |
| NFR-08 | Decimal not used for currency | schema + tests |

## 8. Business rules index
| Rule | Nội dung |
|---|---|
| BR-001 | ISBN nếu có phải unique; SKU là mã quản lý nội bộ unique |
| BR-002 | Unit price VND integer, no client authoritative price |
| BR-003 | `stock >= 0` invariant across concurrent checkouts |
| BR-004 | PENDING order → CONFIRMED / CANCELED; no skip arbitrary steps |
| BR-005 | CANCEL restocks exactly once; delivered cannot cancel via MVP flow |
| BR-006 | Order snapshot không thay đổi theo Product edit |
| BR-007 | Customer chỉ đọc/ghi tài nguyên thuộc chính mình |
| BR-008 | Payment provider callback cần verify signature trước update (future) |
| BR-009 | Published book cần valid title, SKU, price, cover URL theo business policy |

## 9. Detailed Acceptance Criteria
- AC-01: Guest lọc category và search kết quả đúng; pagination ổn định.
- AC-02: Không đăng nhập không thể checkout; UI redirect sang login; API trả 401.
- AC-03: Customer A không truy cập order/address Customer B.
- AC-04: Request tạo đơn quantity=2 stock=1 => error, DB không có partial order.
- AC-05: 2 request song song cùng mua cuốn cuối => chính xác 1 thành công.
- AC-06: Retry create order với cùng idempotency key không tạo đơn kép.
- AC-07: Cancel PENDING 2 lần => inventory restore 1 lần; response lần 2 deterministic.
- AC-08: Admin set SHIPPING từ PENDING bị reject 409/422.
- AC-09: Thay giá sách sau order => order item snapshot giữ giá cũ.
- AC-10: Admin user list không trả passwordHash; auth logs không lộ token.

## 10. Out-of-scope details
Refund/return, coupon, shipping integration, loyalty, reviews, analytics warehouse; thêm ADR và cập nhật SRS nếu đưa vào phase kế tiếp.
