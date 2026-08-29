# Hướng dẫn tích hợp đăng nhập SSO + đồng bộ tài khoản AMS

Tài liệu này mô tả lại đầy đủ cách dự án DH Telecom tích hợp với **AMS** (hệ thống quản lý nhân sự nội bộ của công ty), để Claude Code có thể đọc và triển khai **một tính năng tương đương** ở một project NestJS + React khác. Đây không phải code dùng chung — mỗi project cần cài lại theo stack riêng của nó, tài liệu này chỉ mô tả luồng nghiệp vụ + cấu trúc code mẫu.

> Đưa nguyên file này cho Claude Code ở project khác kèm câu lệnh: *"Đọc file này, tạo lại tính năng SSO + đồng bộ AMS tương đương cho project này, áp dụng đúng stack hiện tại của project"*.

## 1. Bối cảnh / mục tiêu

AMS là hệ thống HRM nội bộ, cung cấp:
- **OAuth2-like SSO** để người dùng đăng nhập vào app con bằng tài khoản AMS, không cần tạo mật khẩu riêng.
- **API tra cứu danh sách nhân sự** (Operators / Employees) để đồng bộ thông tin (họ tên, phòng ban, SĐT, chức vụ...) vào app con.

App con (project này) cần:
1. Cho phép đăng nhập bằng usernamem/password nội bộ **VÀ** đăng nhập SSO qua AMS — cùng tồn tại song song.
2. Khi người dùng đăng nhập SSO lần đầu → tự tạo tài khoản nội bộ tương ứng (map theo email).
3. Khi đăng nhập SSO các lần sau → tự cập nhật lại các trường đồng bộ (họ tên, phòng ban, SĐT, chức vụ) theo dữ liệu mới nhất từ AMS.
4. Admin có màn hình riêng để **chủ động đồng bộ hàng loạt** danh sách nhân sự từ AMS (không cần đợi từng người tự đăng nhập).

## 2. Biến môi trường cần khai báo

```env
# SSO OAuth2
SSO_CLIENT_ID=<client id do AMS cấp>
SSO_CLIENT_SECRET=<client secret do AMS cấp>
SSO_AUTHORIZE_URL=https://ams.<domain>/Api/Sso/Authorize
SSO_TOKEN_URL=https://ams.<domain>/Api/Sso/Token
SSO_USERINFO_URL=https://ams.<domain>/Api/Sso/UserInfo
SSO_REFRESH_URL=https://ams.<domain>/Api/Auth/Refresh_Token
SSO_REDIRECT_URI=https://<domain-app-con>/api/auth/sso/callback

# Đồng bộ nhân sự hàng loạt (không qua OAuth, dùng token tĩnh)
AMS_API_URL=https://ams.<domain>/Api
AMS_SYNC_TOKEN=<bearer token được AMS cấp riêng cho việc sync>

FRONTEND_URL=https://<domain-app-con>
```

`SSO_REDIRECT_URI` PHẢI khớp với URI đã đăng ký trên AMS (AMS sẽ chặn nếu lệch).

## 3. Schema dữ liệu (User)

Bổ sung các cột sau vào bảng người dùng hiện có (chỉ thêm, không sửa cột cũ):

```prisma
model User {
  // ...các field hiện có (id, username, fullName, email, role, passwordHash, active...)

  ssoId           String?   @unique   // ID nhân sự bên AMS (OPER_ID), dùng để map lần sau không cần qua email
  department      String?             // Tên phòng/ban đầy đủ
  departmentGroup String?             // Mã nhóm phòng ban (khối)
  phone           String?
  position        String?
  lastLogin       DateTime?           // set mỗi lần issue JWT (cả password login và SSO)
}
```

Migration tương ứng (Postgres, an toàn — chỉ ADD COLUMN):
```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ssoId" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "departmentGroup" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP(3);
```

## 4. Luồng SSO OAuth2 (đăng nhập)

```
[Frontend Login page]
   │ click "Đăng nhập bằng AMS"
   ▼
GET /api/auth/sso/login?return_to=<origin frontend>
   │ (backend) sinh state ngẫu nhiên, lưu {returnTo, expiresAt} vào Map in-memory (TTL 5 phút)
   │ redirect sang AMS_AUTHORIZE_URL?client_id=...&redirect_uri=...&state=...&response_type=code
   ▼
[AMS] người dùng đăng nhập / đồng ý
   ▼
GET /api/auth/sso/callback?code=...&state=...
   │ (backend)
   │  1. validate + consume state (chống CSRF, chỉ dùng 1 lần)
   │  2. POST AMS_TOKEN_URL  (grant_type=authorization_code) → lấy access_token AMS
   │  3. GET AMS_USERINFO_URL (Bearer access_token)          → lấy thông tin nhân sự
   │  4. syncUserFromSso(ssoUser)  → tạo/cập nhật user nội bộ (mục 5)
   │  5. issueJwt(user)            → JWT nội bộ (access token ngắn hạn)
   │  6. set cookie refresh token nội bộ (httpOnly, path=/api/auth/refresh)
   │  7. redirect → `${returnTo}/auth/callback#token=<jwt>&amsToken=<access_token AMS>`
   ▼
[Frontend /auth/callback]
   │ đọc token từ URL fragment (KHÔNG dùng query string — tránh lưu token vào server log/history)
   │ xoá fragment khỏi URL (window.history.replaceState)
   │ lưu amsToken vào localStorage (dùng riêng cho tính năng admin sync hàng loạt, mục 6)
   │ gọi loginWithSso(jwt) → lưu access token vào state app, gọi GET /api/auth/me để lấy user
   │ navigate('/')
```

### Điểm quan trọng cần giữ nguyên khi triển khai lại
- **State chống CSRF**: bắt buộc, lưu kèm TTL ngắn (5 phút), one-time-use (xoá ngay khi validate).
- **Token trả về cho frontend qua URL fragment (`#...`), không phải query (`?...`)** — fragment không bị gửi lên server, không lưu vào access log.
- Refresh token nội bộ dùng **chung cơ chế với đăng nhập password** (cookie httpOnly riêng) — không phụ thuộc vào khả năng refresh của AMS, để tránh việc AMS hết hạn refresh làm chết phiên app con.
- **Đặt tên cookie refresh token riêng biệt, có prefix của app** (vd `dh_refresh_token`), **không dùng tên chung như `refresh_token`** — nếu app con và AMS chạy cùng domain cha, cookie trùng tên sẽ bị ghi đè lẫn nhau gây lỗi 401 khó debug. Đây là một lỗi thực tế đã gặp trong project gốc.
- Toàn bộ lỗi trong callback phải redirect về frontend kèm `?error=<code>` thay vì trả lỗi JSON (vì đây là 1 server-side redirect, không có ai ở phía client đang chờ JSON).

## 5. Hàm đồng bộ user khi đăng nhập SSO (`syncUserFromSso`)

Đây là phần **dễ sai nhất** — vì field name AMS trả về cho `/UserInfo` **không có tài liệu chính thức và không cố định kiểu OIDC chuẩn**. Phải:

1. Khai báo interface với NHIỀU biến thể tên field có thể gặp (camelCase, PascalCase, UPPER_SNAKE kiểu HRM):
   ```ts
   interface SsoUserInfo {
     sub?: string; UserId?: string;
     email?: string; Email?: string;
     name?: string; FullName?: string; fullName?: string; Name?: string;
     username?: string; UserName?: string;
     roles?: string[]; Roles?: string[];
     position?: string; Position?: string;
     department?: string; Department?: string;
     departmentGroup?: string; DepartmentGroup?: string;
     // tên field THỰC TẾ xác nhận được qua log (xem bước 2 dưới đây)
     departmentId?: string;
     departmentName?: string;
     departmentFullName?: string;
     // các field theo style API bulk-sync khác, dùng làm fallback
     FULLDEPTNAME?: string; DEPT_NAME?: string; DEPT_GROUP?: string;
     POS_NAME?: string; MOBILE?: string;
   }
   ```
2. **Không đoán mò field rồi coi như xong.** Thêm log cảnh báo khi field quan trọng (vd `department`) đọc ra rỗng, in toàn bộ payload thô:
   ```ts
   if (!department) {
     logger.warn(`Không đọc được department từ SSO userinfo. Raw payload: ${JSON.stringify(ssoUser)}`);
   }
   ```
3. **Xác nhận field thật bằng dữ liệu live**: yêu cầu 1 người đăng nhập SSO thật trong lúc tail log backend (`tail -f -n0 backend.log | grep -i "raw payload"`), đối chiếu JSON thật trả về để biết tên field chính xác, rồi sửa lại thứ tự ưu tiên đọc field. Đừng tin field name suy ra từ một API khác (vd API bulk-sync) vì 2 API khác nhau của cùng hệ thống AMS có thể dùng tên field khác nhau cho cùng 1 khái niệm.

4. Logic map user (theo thứ tự ưu tiên tìm user đã tồn tại):
   ```
   1. Tìm theo ssoId (OPER_ID) nếu có
   2. Nếu không thấy, tìm theo email
   3. Nếu vẫn không thấy → tạo mới (username sinh từ email, đảm bảo unique bằng cách thêm số đếm)
   4. Nếu user tồn tại → chỉ UPDATE field nào AMS trả về có giá trị (không ghi đè bằng null/rỗng)
   5. Nếu user.active === false → throw lỗi 'account_inactive' (không cho đăng nhập)
   6. Nếu không có email ở bước tạo mới → throw 'no_email'
   ```
5. Role mapping: map từ mảng `roles` (chuỗi quyền AMS trả về) sang role nội bộ bằng cách kiểm tra substring (`includes('ADMIN')`, `includes('SUPERVISOR')`...), fallback role thấp nhất nếu không khớp gì.

## 6. Đồng bộ hàng loạt (Admin tự bấm, không cần SSO)

Ngoài luồng tự động lúc đăng nhập, cần 1 màn hình Admin để chủ động kéo + cập nhật thông tin toàn bộ nhân sự, áp dụng cho 2 trường hợp:
- Nhân sự **chưa từng đăng nhập SSO lần nào** (chưa có tài khoản nội bộ).
- Cần refresh lại thông tin (đổi phòng ban, đổi SĐT...) mà không cần chờ họ đăng nhập lại.

Có 2 API AMS khác nhau cho mục đích này trong ví dụ gốc, tuỳ hệ thống AMS thực tế có gì thì chọn 1:

**a) Dùng access token của chính admin đang đăng nhập (lấy từ SSO lúc nãy, lưu localStorage phía FE)**
```
GET  {AMS_API_URL}/Systems/Operators_Sync_Getlist   (Bearer <amsToken của admin>)
→ trả mảng nhân sự, FE hiển thị bảng kèm trạng thái: new / update / skip / no-email
→ admin tick chọn → POST lên backend kèm danh sách username đã chọn → backend gọi lại API trên,
  filter theo username, rồi create/update user nội bộ tương ứng
```
Endpoint backend:
```
POST /api/admin/sync/ams-users/list   { amsToken }              → liệt kê + tính sẵn syncStatus
POST /api/admin/sync/ams-users        { amsToken, selectedUsernames[] } → thực thi đồng bộ
```
Trạng thái hiển thị cho từng dòng (tính ở backend, trả kèm field `syncStatus`):
- `no-email` — AMS không có email → không thể map, không cho chọn
- `new` — chưa có user nội bộ tương ứng → sẽ tạo mới
- `update` — có user nhưng chưa từng SSO (`ssoId` null) → sẽ cập nhật
- `skip` — đã đồng bộ rồi (đã có `ssoId`) — vẫn cho chọn lại nếu muốn force refresh

**b) Dùng token tĩnh server-to-server (`AMS_SYNC_TOKEN`), không phụ thuộc phiên đăng nhập ai cả**
```
GET {AMS_API_URL}/Employee/List   (Bearer AMS_SYNC_TOKEN)
→ chỉ UPDATE user đã tồn tại (theo email), KHÔNG tạo mới — dùng để "làm mới" định kỳ, an toàn hơn
```
Endpoint backend: `POST /api/admin/sync/employees` (không cần body, dùng token tĩnh trong env).

> Cách (a) cần thiết khi muốn **tạo tài khoản hộ** nhân sự chưa từng đăng nhập. Cách (b) an toàn hơn để chạy định kỳ/cron vì không tự tạo user mới ngoài ý muốn — chỉ chọn 1 trong 2 hoặc làm cả 2 tuỳ nhu cầu thực tế của project mới.

### Lưu ý khi gọi API AMS
- AMS có thể trả **HTTP 200 nhưng kèm payload lỗi riêng** dạng `{ O_RESULT: -2, O_MESSAGE: "..." }` — PHẢI kiểm tra cả `resp.ok` VÀ field lỗi custom này, không chỉ dựa vào status code.
- Khi token AMS hết hạn, đừng trả thẳng HTTP 401 ra cho frontend — axios interceptor phía FE coi 401 là "phiên app con hết hạn" và sẽ tự gọi refresh-token nội bộ, gây nhiễu. Map sang status khác (project gốc dùng `422 Unprocessable Entity` với message `ams_token_expired`) để FE phân biệt được đây là lỗi token AMS, không phải lỗi phiên app con.
- Response shape của list nhân sự có thể nằm ở nhiều key khác nhau tùy version AMS (`O_DATATABLE`, `data`, `items`, `result`...) — viết hàm parse thử nhiều khả năng, log lại key thực tế nếu không khớp cái nào để dễ debug.

## 7. Checklist triển khai cho project mới

**Backend:**
- [ ] Thêm cột `ssoId/department/departmentGroup/phone/position/lastLogin` vào bảng user (migration ADD COLUMN, không sửa cột cũ)
- [ ] `SsoService`: `getLoginUrl`, `validateAndConsumeState`, `exchangeCode`, `getUserInfo`, `syncUserFromSso`, `issueJwt`, `refreshSsoToken`, `exchangeAmsAccessToken` (cho use-case nhúng iframe nếu cần)
- [ ] `AuthController`: `GET sso/login`, `GET sso/callback`, `POST sso/refresh`, giữ nguyên route password login/refresh/logout hiện có, dùng chung cookie refresh
- [ ] `AmsSyncService` + `AdminController`: `listOperators`, `syncSelected`, `bootstrapEmployees`
- [ ] Thêm log cảnh báo + raw payload khi field SSO quan trọng đọc ra rỗng (bước xác minh field thật)
- [ ] Khai báo đủ biến môi trường ở mục 2

**Frontend:**
- [ ] Nút "Đăng nhập bằng AMS" trên trang Login → redirect `GET /api/auth/sso/login?return_to=<window.location.origin>`
- [ ] Trang `/auth/callback`: đọc token từ URL **fragment**, xoá fragment khỏi history, lưu amsToken (nếu có) vào localStorage, gọi `loginWithSso(token)`, redirect về trang chủ; xử lý các mã lỗi `?error=...` hiển thị thông báo tương ứng rồi tự chuyển về `/login` sau ~3-4s
- [ ] `useAuth`: thêm `loginWithSso(accessToken)` — set access token vào state/storage, gọi `GET /api/auth/me` để lấy thông tin user
- [ ] Màn hình Admin "Đồng bộ AMS": bảng liệt kê nhân sự kèm filter theo `syncStatus`, cho chọn nhiều dòng, nút đồng bộ gọi `POST /api/admin/sync/ams-users`

**Kiểm thử bắt buộc trước khi coi là xong:**
- [ ] Đăng nhập SSO lần đầu (chưa có tài khoản nội bộ) → tài khoản mới được tạo đúng email/role
- [ ] Đăng nhập SSO lần 2 với thông tin AMS đã đổi (vd đổi phòng ban) → tài khoản nội bộ được cập nhật, không bị ghi đè bằng rỗng nếu AMS trả thiếu field nào đó
- [ ] Tài khoản bị set `active=false` → đăng nhập SSO bị chặn với lỗi rõ ràng
- [ ] Refresh token nội bộ hoạt động độc lập, không phụ thuộc phiên AMS còn sống hay không
- [ ] Test cookie refresh token KHÔNG bị trùng tên với cookie nào của hệ thống SSO cha (nếu chạy chung domain)
