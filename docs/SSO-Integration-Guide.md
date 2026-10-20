# Hướng dẫn tích hợp SSO với AMS (Api/Sso/*)

> Tài liệu dành cho dev của **app khác** cần tích hợp đăng nhập/đăng xuất qua SSO của AMS, hoặc cho bất
> kỳ session/dev nào cần đọc lại bối cảnh khi làm việc trên `AMS-NEW/API/Controllers/SSO/`.
> Viết lần đầu sau đợt xây dựng quản lý SSO Client + vá lỗi đăng xuất (2026-09-22).
> **Rà soát lại và sửa 2 điểm sai/lạc hậu so với code thực tế vào 2026-10-20** — xem mục "Đã sửa ở lần
> rà soát này" cuối file.

## 1. Tổng quan

AMS đóng vai trò **IdP (Identity Provider)** cho các app nội bộ khác qua 1 luồng kiểu OAuth2 Authorization Code, phơi ra dưới `Api/Sso/*`. Có 2 controller:

- **`SSOController.cs`** (`Api/Sso/Authorize|Token|UserInfo|Logout`) — luồng **chung**, dùng cho mọi app khác ngoài Nextcloud (vd OKR). **Đây là luồng app mới nên dùng.**
- **`DMSController.cs`** (`Dms/Authorize|Token|UserInfo|Logout|CheckLogin`) — luồng **riêng** cho Nextcloud/DMS (3 instance: prod/dev/dms2), có thêm bước đồng bộ hồ sơ người dùng vào Nextcloud qua OCS API. Không khuyến nghị app mới dùng lại luồng này trừ khi thực sự giống Nextcloud.

Danh sách "client nào được phép SSO, redirect_uri nào hợp lệ" nằm trong 1 bảng quản trị được (không còn hardcode switch-case như trước 2026-09-22):

- **Bảng `ACT.SSO_CLIENT`** — 1 dòng = 1 app được phép SSO.
- **Màn quản trị**: `ReactJs/ams`, menu **Hệ thống > SSO Client** (`/system/sso-clients`), quyền `SYSTEM_SSO_VIEW`/`INSERT`/`UPDATE`/`DELETE`.
- Cả `SSOController` lẫn `DMSController` đều tra bảng này để xác thực `client_id`/`redirect_uri`.

## 2. Cấu trúc bảng `ACT.SSO_CLIENT`

| Cột | Ý nghĩa |
|---|---|
| `CLIENT_ID` (PK) | Mã định danh app, app tự gửi lên khi gọi `Authorize` |
| `CLIENT_NAME` | Tên hiển thị (chỉ để quản trị dễ nhận diện) |
| `REDIRECT_URI` | Địa chỉ callback **duy nhất** được chấp nhận sau khi **đăng nhập** thành công — phải khớp **chính xác** (case-insensitive) với `redirect_uri` app gửi lên `Authorize` |
| `LOGOUT_REDIRECT_URI` | Địa chỉ redirect về sau khi **đăng xuất** xong (vd trang `/login` của app) — **khác** `REDIRECT_URI` ở trên, KHÔNG dùng lại được cho logout vì đó là URL chờ nhận `code`/`state`. Nullable — để trống thì `Api/Sso/Logout` chỉ hiện trang xác nhận, không tự redirect đi đâu |
| `BASE_URL` | Chỉ dùng cho luồng kiểu Nextcloud (gọi ngược OCS API đồng bộ hồ sơ) — hầu hết app khác để trống |
| `AUDIENCE` | ⚠️ **Hiện KHÔNG được code đọc để ghi vào `id_token`** — xem cảnh báo ở mục 4b |
| `TOKEN_EXPIRES_MINUTES` | ⚠️ **Hiện KHÔNG được code đọc để tính hạn `id_token`** — xem cảnh báo ở mục 4b |
| `FLAG_ACTIVE` | `0` = vô hiệu hóa, app bị từ chối `Authorize` ngay lập tức |
| `DESCRIPTION` | Ghi chú tự do |

Proc: `act.sso_client_getlist/getbyid/insert/update/delete` (schema/quy ước xem `plan/step230-sso-client-management.sql`, `plan/step231-sso-client-logout-redirect.sql`).

## 3. Đăng ký 1 app mới vào SSO — việc **bắt buộc trước khi** app đó gọi được `Api/Sso/Authorize`

⚠️ `SSOController.Authorize` kiểm tra CHẶT CHẼ: `client_id` chưa có trong `ACT.SSO_CLIENT` (hoặc `redirect_uri` gửi lên không khớp) → bị từ chối ngay (hiện trang lỗi HTML, không redirect). Đây là hành vi **cố ý** để vá lỗ hổng open-redirect (trước 2026-09-22, `redirect_uri` không được kiểm tra gì cả).

**Cách đăng ký**: vào `ams.vienthongact.vn` → **Hệ thống > SSO Client** → **Thêm client**, điền:
- `Client ID`: chuỗi định danh app tự chọn (khớp với giá trị app sẽ gửi lên `Authorize`)
- `Redirect URI`: callback nhận `code` lúc đăng nhập (vd `https://<app>/api/auth/sso/callback`)
- `Redirect URI sau đăng xuất` (tùy chọn nhưng **nên điền** — xem mục 5): trang đăng nhập của app (vd `https://<app>/login`)
- `Audience`/`Thời hạn token`: điền tùy ý nếu muốn, nhưng **hiện không có tác dụng thật** (mục 4b) — đừng dựa vào đây để đổi hạn token.

Hoặc chạy trực tiếp qua psql (dùng khi cần gấp, không đợi build FE):

```sql
SELECT * FROM ACT.SSO_CLIENT_INSERT(
  '<client_id>', '<Tên hiển thị>', '<redirect_uri đăng nhập>',
  NULL,           -- BASE_URL (bỏ trống trừ khi giống Nextcloud)
  'ams',          -- AUDIENCE (không ảnh hưởng token thật, xem mục 4b)
  1440,           -- TOKEN_EXPIRES_MINUTES (không ảnh hưởng token thật, xem mục 4b)
  '<mô tả>', NULL, -- I_OPER_ID (ai tạo, có thể NULL)
  '<redirect_uri sau đăng xuất>'  -- I_LOGOUT_REDIRECT_URI, optional
);
```

## 4. Luồng đăng nhập (login) — tóm tắt cho app con

1. App redirect trình duyệt sang: `GET https://ams.vienthongact.vn/Api/Sso/Authorize?client_id=<id>&redirect_uri=<callback>&state=<random>&response_type=code`
2. AMS kiểm tra `client_id`/`redirect_uri` khớp `ACT.SSO_CLIENT` (mục 3) → kiểm tra đăng nhập AMS (session hoặc cookie `a-sessionid` bền vững) → nếu chưa đăng nhập, redirect sang trang login AMS (`/sso/`); nếu đã đăng nhập, kiểm tra quyền (mục 4a) → sinh `code` → redirect về `redirect_uri` kèm `code`+`state`.
3. App backend đổi `code` lấy token: `POST Api/Sso/Token` (`grant_type=authorization_code`, `code`, `client_id`, `redirect_uri`).
4. App backend gọi `GET Api/Sso/UserInfo` (Bearer `access_token`) lấy hồ sơ user (`id`, `sub`, `name`, `email`, `employeeCode`, `roles[]`, `departmentId/Name/FullName/Group`, `position`).

### 4a. Ai được phép đăng nhập qua SSO — ⚠️ đính chính so với bản tài liệu trước

Bản trước (2026-09-22) ghi: *"quyền dùng app dựa trên `PERM_GROUPCODE` khớp `client_id`"* — **điều này SAI cho luồng chuẩn mà app ngoài sẽ dùng.** Đọc lại code thực tế (`SSOController.Authorize`, dòng kiểm tra quyền):

```csharp
DataRow[] drs = dtPerms.Select("PERM_CODE='WS_API'");
```

→ Điều kiện thật sự chỉ là: **user có quyền `WS_API`** (quyền API chung của AMS, giống hệt quyền cần để đăng nhập AMS bằng mật khẩu bình thường — xem `AuthController.cs`). **Không có bước kiểm tra riêng theo từng `client_id`** trong luồng tương tác (trình duyệt) này.

Hệ quả cần biết khi tích hợp: **đăng ký `client_id` vào `ACT.SSO_CLIENT` chỉ kiểm soát app nào được phép nhận luồng SSO** (chặn app lạ/redirect_uri giả mạo) — **không kiểm soát được user nào được dùng app đó**. Bất kỳ user AMS nào có quyền `WS_API` (tức đăng nhập AMS bình thường được) đều SSO thành công vào **mọi** app đã đăng ký. Nếu app con cần giới hạn theo người dùng/phòng ban cụ thể, phải tự làm việc đó ở phía app con (dựa vào `roles`/`departmentId`/`employeeCode` trả về từ `UserInfo`), **không trông chờ AMS chặn hộ theo `client_id`**.

(Riêng `DMSController` — luồng Nextcloud — đọc điều kiện tương tự nhưng ở cột khác: `dtPerms.Select("PRIV_CODE='WS_API'")`. Tên cột khác nhau giữa 2 controller dù cùng ý nghĩa; không ảnh hưởng tới app ngoài, chỉ ghi chú lại cho ai đọc code sau này khỏi bối rối.)

Riêng `Api/Sso/Token` còn có 1 nhánh phụ hiếm gặp (đọc `data.code` như 1 JWT ES256 do DMS ký, dùng cho tích hợp "add external site" kiểu Nextcloud) — nhánh đó MỚI thật sự kiểm tra `PERM_GROUPCODE = client_id`. App mới tích hợp theo hướng dẫn ở tài liệu này (dùng `code` do chính `Authorize` cấp, dạng GUID lưu trong `MemoryCacheHelper`) sẽ **không** đi vào nhánh này — chỉ nêu ra để khỏi nhầm lẫn khi đọc code `Token()`.

### 4b. `AUDIENCE`/`TOKEN_EXPIRES_MINUTES` — cột có trong DB nhưng chưa được code dùng

Cả `SSOController.CreateIdToken()` lẫn `DMSController.CreateIdToken()` đều **hardcode thẳng** trong code, không đọc từ `ACT.SSO_CLIENT`:

```csharp
// SSOController.CreateIdToken
audience: "ams",
expires: DateTime.UtcNow.AddMinutes(App.Jwt_Expires),

// DMSController.CreateIdToken
audience: "nextcloud",
expires: DateTime.UtcNow.AddMinutes(30),
```

Nghĩa là 2 cột `AUDIENCE`/`TOKEN_EXPIRES_MINUTES` trên màn quản trị "SSO Client" hiện **chỉ lưu vào DB, không có tác dụng thật** lên `id_token` sinh ra. Mọi client qua `Api/Sso/*` đều nhận `audience="ams"`, hạn theo `App.Jwt_Expires` (cấu hình chung toàn hệ thống) — bất kể đã điền gì ở 2 ô đó. Đây là khoảng trống thật trong code (có thể là tính năng làm dở, chưa nối dây), **không phải tài liệu ghi sai** — ghi lại ở đây để ai tích hợp sau không mất công chỉnh `TOKEN_EXPIRES_MINUTES` riêng cho client của mình rồi thắc mắc sao không có tác dụng.

## 5. Luồng đăng xuất (logout) — **bắt buộc app con phải chủ động gọi**

### Vì sao cần bước này

AMS dùng cookie `a-sessionid` (scoped domain `ams.vienthongact.vn`) + Redis để nhớ đăng nhập bền vững qua nhiều app (để đúng nghĩa "đăng nhập 1 lần"). Nếu app con chỉ tự xóa session/cookie **của chính nó** khi user bấm "Đăng xuất", cookie AMS vẫn còn sống — lần sau quay lại `Authorize`, AMS **tự đăng nhập lại ngay** không hỏi gì → cảm giác "không đăng xuất được".

**Không có cách nào AMS tự động biết app con đã đăng xuất** nếu app con không chủ động báo — đây là giới hạn kỹ thuật cơ bản của mọi SSO (cookie/session của domain khác không ai "với tay" vào được).

### Endpoint

```
GET https://ams.vienthongact.vn/Api/Sso/Logout?client_id=<id>
```

- **Chỉ nhận `client_id`** — **không** nhận `redirect_uri` từ caller (khác hẳn `Authorize`). Địa chỉ đích sau khi đăng xuất luôn lấy từ `LOGOUT_REDIRECT_URI` đã đăng ký sẵn trong DB (AMS tự quyết định, không tin dữ liệu từ URL) — loại bỏ hoàn toàn nguy cơ open-redirect ở endpoint này.
- Xóa: ASP.NET Session, cookie `a-sessionid`/`a-tenantid`, entry Redis `sessionId:<...>` tương ứng.
- Nếu client có `LOGOUT_REDIRECT_URI` → 302 redirect về đó. Nếu không → trả trang HTML "Đã đăng xuất" (branded, `SsoErrorPage.cs`).

### Cách tích hợp phía app con — **bắt buộc điều hướng toàn trang**

```js
// Sau khi app tự xóa session/cookie CỦA CHÍNH NÓ xong:
window.location.href = "https://ams.vienthongact.vn/Api/Sso/Logout?client_id=" + encodeURIComponent(CLIENT_ID);
```

⚠️ **Phải dùng điều hướng trình duyệt thật** (`window.location.href`, `<a href>`, redirect HTTP...) — **không** được gọi bằng `fetch`/`axios`/XHR. Lý do: cookie `a-sessionid` là `HttpOnly` + scoped domain `ams.vienthongact.vn`; chỉ khi trình duyệt tự điều hướng tới domain đó, nó mới gửi/nhận đúng cookie để AMS xóa được. Một request nền (AJAX) từ app con, dù có `credentials:'include'`, cũng không đáng tin cậy bằng 1 điều hướng thật (dễ vướng CORS/chính sách cookie bên thứ 3 của trình duyệt hiện đại).

**Ví dụ triển khai thực tế** (OKR, `c:\Data\DEV\OKR`):
- Backend `backend/src/controllers/auth.controller.ts` — hàm `logout()`: xóa cookie riêng của OKR, rồi trả về JSON kèm `ssoLogoutUrl` (không tự redirect ở backend vì được gọi qua AJAX từ FE).
- Frontend `frontend/src/components/layout/Header.tsx` + `frontend/src/pages/settings/ProfilePage.tsx`: gọi API logout xong, nếu response có `ssoLogoutUrl` thì `window.location.href = ssoLogoutUrl` (thay vì chỉ `navigate('/login')` nội bộ).

Copy nguyên khối này cho app mới là đủ, chỉ đổi `CLIENT_ID`.

## 6. Bảo mật — các nguyên tắc đã áp dụng, giữ nguyên khi sửa sau này

- **Không bao giờ** tin `redirect_uri` do caller gửi lên mà không đối chiếu với DB trước (đây chính là lỗ hổng đã vá ở `SSOController.Authorize`/`DMSController.Authorize`).
- `Api/Sso/Logout` cố tình **không nhận `redirect_uri` từ query string** — tránh lặp lại kiểu lỗ hổng tương tự ở 1 endpoint mới.
- Mọi lỗi validate (`client_id`/`redirect_uri` sai) trả về qua `SsoErrorPage.cs` — trang HTML gọn gàng, **không** redirect ngược về địa chỉ đang bị nghi ngờ (dù có giá trị hay không).
- Khi thêm cột/tham số mới vào `cSSO_CLIENT.cs`, nhớ: Npgsql gọi proc Postgres **theo vị trí tham số** (`SELECT * FROM schema.func($1,$2,...)`), tham số mới luôn thêm **cuối cùng** trong danh sách IN param — sai thứ tự sẽ lỗi âm thầm hoặc gán nhầm giá trị.
- **Biết trước khi dùng** (mục 4a): việc đăng ký `client_id` không giới hạn user nào được SSO vào app đó — nếu nghiệp vụ cần giới hạn, app con phải tự kiểm tra `roles`/`departmentId`/`employeeCode` từ `UserInfo` chứ không trông chờ AMS chặn hộ.

## 7. Các file liên quan

**AMS-NEW** (`c:\Data\DEV\AMS-NEW`):
- `plan/step230-sso-client-management.sql` — tạo bảng + CRUD proc ban đầu, seed 3 client Nextcloud.
- `plan/step231-sso-client-logout-redirect.sql` — thêm `LOGOUT_REDIRECT_URI`.
- `DbAccess/SSO/cSSO_CLIENT.cs` — lớp truy cập DB.
- `API/Controllers/SSO/SSOController.cs` — `Authorize`/`Token`/`UserInfo`/`Logout` (luồng chung, app mới dùng cái này).
- `API/Controllers/SSO/DMSController.cs` — luồng riêng Nextcloud.
- `API/Controllers/SSO/SsoClientController.cs` — CRUD cho màn quản trị (`Api/Sso/SsoClient_GetList/...`).
- `API/Controllers/SSO/SsoErrorPage.cs` — trang HTML lỗi/xác nhận dùng chung.

**ReactJs/ams** (`c:\Data\DEV\ReactJs\ams`):
- `src/modules/system/pages/SsoClients/` — màn quản trị.
- `src/modules/system/api/ssoClientAPI.js`.
- `src/modules/system/manifest.jsx` — đăng ký menu/route/quyền.
- `src/shared/components/common/AppTextField.jsx` — wrapper `TextField` mặc định `shrink:true` cho label (tiện thể tạo ra khi sửa giao diện form này — dùng cho MỌI form mới trong app, không riêng SSO).

## 8. Việc còn dang dở / cần làm khi rảnh (không khẩn cấp)

- **Nối `AUDIENCE`/`TOKEN_EXPIRES_MINUTES` vào `CreateIdToken()`** của cả 2 controller — hiện 2 cột này trên màn quản trị không có tác dụng thật (mục 4b), nên sửa code để đọc đúng theo từng client, hoặc bỏ hẳn 2 ô đó khỏi form quản trị cho khỏi gây hiểu lầm.
- **Cân nhắc thêm kiểm tra phân quyền theo từng `client_id`** ở luồng tương tác (`SSOController.Authorize`) nếu về sau có nhu cầu giới hạn app nào dành cho nhóm user nào — hiện mọi user có `WS_API` đều vào được mọi app đã đăng ký (mục 4a).
- **Rút ngắn thời gian "nhớ đăng nhập"** (`App.Cookie_Expires`, hiện tính theo ngày) — sẽ giảm mức ảnh hưởng nếu 1 app nào đó quên tích hợp bước đăng xuất (mục 5).
- **Trang "Đăng xuất khỏi mọi ứng dụng"** ngay trên AMS — cho user tự chủ động kết thúc phiên SSO của mình mà không phụ thuộc app nào có tích hợp logout hay chưa.
- 3 client Nextcloud hiện chưa có `LOGOUT_REDIRECT_URI` (dùng `Dms/Logout` riêng, tự xử lý redirect) — không bắt buộc phải điền, chỉ điền nếu muốn chuẩn hóa dùng chung `Api/Sso/Logout`.

## Đã sửa ở lần rà soát này (2026-10-20)

So với bản viết lần đầu (2026-09-22), đối chiếu lại trực tiếp với code (`SSOController.cs`, `DMSController.cs`) phát hiện và sửa:

1. **Mục 4a (đính chính quan trọng)**: tài liệu cũ nói quyền dùng app dựa trên `PERM_GROUPCODE=client_id` — sai cho luồng chuẩn. Code thực tế chỉ kiểm tra quyền `WS_API` chung, không phân biệt theo `client_id`. `PERM_GROUPCODE=client_id` chỉ áp dụng cho 1 nhánh phụ hiếm gặp trong `Token()` (JWT do DMS ký), không phải luồng app mới sẽ dùng.
2. **Mục 4b (mới thêm)**: phát hiện `AUDIENCE`/`TOKEN_EXPIRES_MINUTES` trong `ACT.SSO_CLIENT` **không được code đọc** — `CreateIdToken()` của cả 2 controller hardcode cứng, bỏ qua 2 cột này hoàn toàn. Tài liệu cũ mô tả 2 cột này như thể có tác dụng thật.

Phần còn lại (cấu trúc bảng, luồng Authorize/Token/UserInfo, luồng Logout, nguyên tắc bảo mật, ví dụ OKR) đối chiếu lại đúng với code hiện tại, giữ nguyên.
