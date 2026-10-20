# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DH Telecom — hệ thống quản lý tiến độ thi công viễn thông (BTS/NodeB/eNodeB/gNodeB). Thay thế Excel bằng web app cho phép theo dõi Work Orders, SLA, và xuất báo cáo.

GitHub repo: `https://github.com/tayeumi/dh` (branch `main`)

## Dev Commands

### Backend (`backend/`)
```bash
npm run start:dev       # NestJS watch mode (port 3011)
npm run build           # compile TypeScript → dist/
npm run lint            # ESLint fix
npm run db:migrate      # prisma migrate dev (prompts for name)
npm run db:seed         # seed admin user
npm run db:mock         # seed 30 sites, 5 solutions, 2 periods, 137 WOs
npm run db:studio       # Prisma Studio GUI
```

### Frontend (`frontend/`)
```bash
npm run dev             # Vite dev server (port 5183, host 0.0.0.0)
npm run build           # tsc + vite build
npm run lint            # ESLint
```

### Infrastructure (dev)
```bash
# PostgreSQL only — đây là cách dùng chính trong dev
docker-compose -f docker-compose.dev.yml up postgres

# Nginx reverse proxy (proxies port 80 → frontend:5183 + backend:3011)
docker run -d --name dh_nginx -p 80:80 \
  -v ./nginx-local.conf:/etc/nginx/nginx.conf:ro \
  --add-host=host.docker.internal:host-gateway nginx:alpine

docker start/stop dh_nginx
```

### Production (GHCR + Watchtower)
```bash
# Lần đầu deploy trên server (hoặc dùng Portainer Git stack)
cp .env.prod.example .env   # điền giá trị thật
docker compose pull
docker compose up -d

# Từ lần sau: push code lên master → GitHub Actions build tự động
# Watchtower poll GHCR mỗi 5 phút → tự pull & restart
```

## Architecture

### Monorepo structure
```
backend/               — NestJS 11 + Prisma v5 + PostgreSQL 16
frontend/              — React 19 + Vite + MUI v9 + AG Grid v35
docker-compose.yml     — prod stack (pull GHCR images + Watchtower) — dùng trên server/Portainer
docker-compose.dev.yml — dev stack (build từ source, hot-reload) — dùng local
nginx.conf             — dev docker-compose nginx (service names)
nginx-local.conf       — standalone nginx docker (host.docker.internal)
.github/workflows/docker-publish.yml — CI: build & push lên GHCR khi push master
.env.prod.example      — template env cho server production
```

### Backend

**Ports & env**: `PORT=3011`, `DATABASE_URL` points to Postgres at `localhost:5442` (Docker). All env in `backend/.env`.

**Module layout** — mỗi module chứa service + controller + DTOs (co-located trong service file, không tách DTO file riêng):
- `auth` — JWT login/refresh/me + SSO (AMS). Access token 15m in-memory, refresh token 7d httpOnly cookie.
- `users` — CRUD; GET list open cho mọi user đã đăng nhập, write ops ADMIN-only.
- `sites` — CRUD + Excel import/export (SheetJS).
- `solutions` — CRUD.
- `periods` — CRUD + assign solutions/sites/supervisors + generate Work Orders.
- `work-orders` — list với filters, inline field update, Excel export.
- `dashboard` — aggregation queries (summary, by-period, by-solution, by-province).
- `admin` — sync user từ AMS (hệ thống quản lý nhân sự nội bộ) qua `AmsSyncService`.
- `prisma` — singleton `PrismaService` import qua `PrismaModule` (global).

**Auth flow**: `POST /api/auth/login` → `{ accessToken, refreshToken, user }`. Refresh token set httpOnly cookie. `POST /api/auth/refresh` đọc cookie. Guards: `JwtAuthGuard` (mọi route protected), `RolesGuard` + `@Roles(...)`. `@CurrentUser()` decorator extract user từ JWT payload.

**SSO (AMS)**: `GET /api/auth/sso/login` → redirect đến AMS. Callback về `GET /api/auth/sso/callback` → frontend route `/auth/callback` (SsoCallbackPage). Env: `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `SSO_REDIRECT_URI`, `AMS_API_URL`, `AMS_SYNC_TOKEN`.

**2 chế độ chạy** (`backend/src/auth/app-url.ts`): `FRONTEND_URL` quyết định — local `http://localhost:5183` (`backend/.env`), public `https://pkt.vienthongact.vn` (mặc định trong `docker-compose.yml`; Nginx Proxy Manager tại `10.248.137.16` — cùng proxy với AMS — chuyển tiếp về server `192.168.1.27:8080`). `SSO_REDIRECT_URI` bỏ trống → `<FRONTEND_URL>/api/auth/sso/callback`; `COOKIE_SECURE` bỏ trống → Secure chỉ khi `FRONTEND_URL` là https. AMS chỉ nhận 1 Redirect URI mỗi `client_id` → mỗi chế độ cần Redirect URI của nó được đăng ký trên AMS (2 chế độ cùng lúc = 2 client).

**`cookie-parser`** load bằng `require()` (không phải ESM import) do xung đột `emitDecoratorMetadata`. `import type { Response } from 'express'` trong controllers cùng lý do.

**CORS**: `CORS_ORIGIN` trong `.env` là chuỗi phân tách bởi dấu phẩy; `*` cho phép mọi origin.

**SLA logic** (tính tại query time, không lưu DB):
- `installationStatus === COMPLETED` → "Hoàn thành"
- `now > createdAt + expectedDays` → "Quá hạn"
- `now > deadline - 3 days` → "Sắp quá hạn"
- else → "Đúng hạn"

**Period → Work Order generation**: `POST /api/periods/:id/generate-workorders` tạo 1 WO per (site × solution). Bỏ qua combination đã tồn tại. `ticketNo` format: `{periodCode}-{seq:04d}`.

### Frontend

**Cấu trúc thư mục:**
```
src/
  api/          — axios calls theo module (auth, sites, solutions, periods, users, workOrders, dashboard)
  components/
    ui/         — DataGrid, PageHeader, StatusChip, Toolbar, gridCells (shared AG Grid cell renderers)
    layout/     — AppLayout (sidebar + topbar)
    common/     — ConfirmDialog
  hooks/        — useAuth.tsx (AuthProvider + useAuth)
  pages/        — DashboardPage, LoginPage, SsoCallbackPage, SitesPage, SolutionsPage,
                   PeriodsPage, UsersPage, WorkOrdersPage
  theme/        — index.ts (MUI theme), tokens.ts (design tokens), agGridTheme.ts (AG Grid theme)
  types/        — shared TypeScript interfaces
  utils/        — download, etc.
```

**API layer** (`src/api/`): axios instance trong `axios.ts`, `baseURL: import.meta.env.VITE_API_URL ?? ''`. `VITE_API_URL` là **empty string** → tất cả request là relative → Vite dev proxy (`/api → localhost:3011`) xử lý local dev; Nginx xử lý production. Không bao giờ set `VITE_API_URL` thành hostname cứng.

**Auth state** (`src/hooks/useAuth.tsx`): `AuthProvider` gọi `GET /api/auth/me` khi mount để restore session. `hasLoggedIn` ref ngăn mount `catch` ghi đè user state đang được set bởi `login()` đang chạy. Access token lưu trong module-level variable (`setAccessToken`/`getAccessToken`), không dùng localStorage.

**Token refresh** (`src/api/axios.ts`): 401 interceptor gọi `/api/auth/refresh`, queue các request đồng thời trong lúc refresh, retry sau khi thành công. Không redirect về `/login` khi refresh fail — để React Router xử lý.

**MUI v9**: Mọi system prop phải đặt trong `sx={}`. **Không** dùng props trực tiếp như `fontWeight`, `mb`, `display` trên MUI components. Dùng `slotProps` thay cho `PaperProps`, `InputProps` cũ. Theme global trong `src/theme/index.ts` — thêm component overrides ở đây, không inline.

**AG Grid v35** — dùng cho TẤT CẢ các trang danh sách (Sites, Solutions, Periods, Users, WorkOrders):
- Wrapper `components/ui/DataGrid.tsx` đăng ký `AllCommunityModule` một lần cho cả app.
- Theme qua `agGridTheme` (Theming API `themeQuartz.withParams({})`). **Không** import CSS files (`ag-grid.css`, `ag-theme-*.css`) — xung đột với Theming API.
- `suppressCellFocus` set để bỏ cell focus border.
- Không dùng MUI DataGrid (`@mui/x-data-grid`) — project đã chuyển hoàn toàn sang AG Grid.

**Design tokens** (`src/theme/tokens.ts`): Single source of truth cho màu sắc, spacing. Dùng bởi MUI theme, AG Grid theme và mọi shared UI component. Pages import tokens từ đây, không hardcode màu.

**Routing** (`src/App.tsx`): Tất cả authenticated pages nest dưới `AppLayout`. `ProtectedRoute` block unauthenticated. `/auth/callback` → `SsoCallbackPage` (SSO AMS redirect). `PeriodDetail` render inline trong `PeriodsPage` (không phải route riêng).

**Charts** (DashboardPage): Recharts. Import chỉ những gì tồn tại: `BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, CartesianGrid`. `LinearGradient` và `defs` không phải named exports.

### Database

**Prisma v5** — không upgrade lên v7 (v7 bỏ `url = env()` trong datasource). Schema tại `backend/prisma/schema.prisma`.

Key relations:
- `Period` → `PeriodSolution[]`, `PeriodSite[]`, `PeriodUser[]` (supervisors), `WorkOrder[]`
- `WorkOrder` → `Period`, `Site`, `Solution`, `User` (createdBy)
- `PeriodUser` — junction table period ↔ supervisor

Sau mọi schema change: `npm run db:migrate` (trong `backend/`), sau đó restart backend để reload Prisma Client (DLL lock trên Windows cần stop process trước).

**QUY TẮC BẮT BUỘC — Migration production:**
- Mọi thay đổi schema PHẢI có file migration trong `backend/prisma/migrations/<timestamp>_<name>/migration.sql`
- Migration được tự động apply khi container restart (entrypoint.sh chạy `prisma migrate deploy`)
- Chỉ dùng SQL an toàn: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` — KHÔNG `DROP TABLE`, `DROP COLUMN` nếu không có backup
- DTO classes phải có `@IsString()/@IsOptional()/...` decorators — `ValidationPipe({ whitelist: true })` xóa mọi field không decorated
- Không bao giờ push code thay đổi schema mà thiếu migration file tương ứng

### Nginx routing

**Dev** (`nginx.conf` — docker-compose dùng service names):

| Path | Target |
|------|--------|
| `/api/*` | backend:3011 (NestJS) |
| `/@vite/*` | frontend:5183 (Vite HMR websocket) |
| `/*` | frontend:5183 (Vite dev server) |

**Production** (`frontend/nginx.conf` — bên trong frontend container):

| Path | Target |
|------|--------|
| `/api/*` | backend:3011 (NestJS) |
| `/*` | `/usr/share/nginx/html` (static SPA, fallback index.html) |

Trong production (`docker-compose.prod.yml`) không có nginx container riêng — frontend container tự serve static files và proxy `/api/` đến backend container.

### CI/CD

**GitHub Actions** (`.github/workflows/docker-publish.yml`): Trigger khi push lên `main`. Build 2 jobs song song: `hd-backend` và `hd-frontend`, push lên GHCR (`ghcr.io/tayeumi/`). Dùng GHA cache (`type=gha`) để tăng tốc build lần sau. `GITHUB_TOKEN` tự động — không cần PAT.

**Watchtower** (trong `docker-compose.prod.yml`): Poll GHCR mỗi 300s, tự pull image mới và restart container có label `com.centurylinklabs.watchtower.scope=dh`.

**Image names**: `ghcr.io/tayeumi/hd-backend:latest`, `ghcr.io/tayeumi/hd-frontend:latest`

## Seed accounts

| Username | Password | Role |
|----------|----------|------|
| admin | Admin@123 | ADMIN |
| dieuhanh | Dieuhanh@123 | SUPERVISOR (Điều hành — gộp chung Quản lý/MANAGER cũ) |
| kythuat1 | Kythuat@123 | TECHNICIAN |
| kythuat2 | Kythuat@123 | TECHNICIAN |
