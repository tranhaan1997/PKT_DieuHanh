# Hướng dẫn chạy dự án

## Yêu cầu

- Node.js 20+
- Docker Desktop (cho PostgreSQL + deploy)
- Git

---

## Chạy development (local, không Docker)

### Bước 1: Cài dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Bước 2: Chuẩn bị database

Cần PostgreSQL chạy local (port **5442**). Có thể dùng Docker:

```bash
docker run -d \
  --name dh_postgres \
  -e POSTGRES_DB=dh_telecom \
  -e POSTGRES_USER=dh_user \
  -e POSTGRES_PASSWORD="DH_Telecom@2026#Pg" \
  -p 5442:5432 \
  postgres:16-alpine
```

### Bước 3: Cấu hình .env backend

Copy file `.env.example` thành `.env` ở thư mục gốc. Đảm bảo `DATABASE_URL` trỏ đúng.

### Bước 4: Migrate database + seed

```bash
cd backend

# Tạo bảng (DATABASE_URL đọc từ .env: port 5442)
npx prisma migrate dev --name init

# Seed admin user
npm run db:seed
```

Sau khi seed:
- **admin / Admin@123** (ADMIN)
- **dieuhanh / Dieuhanh@123** (SUPERVISOR)

### Bước 5: Chạy backend

```bash
cd backend
npm run start:dev
# Backend chạy tại: http://localhost:3011
```

### Bước 6: Chạy frontend

```bash
cd frontend
npm run dev
# Frontend chạy tại: http://localhost:5183
```

---

## Chạy với Docker Compose (development)

```bash
# Ở thư mục gốc
cp .env.example .env   # chỉnh sửa nếu cần

docker-compose up --build

# Sau lần đầu, migrate DB:
docker exec dh_backend npx prisma migrate deploy
docker exec dh_backend npm run db:seed
```

Truy cập: http://localhost:5183

---

## Deploy production (Linux VPS)

```bash
# Clone code lên server
git clone <repo> && cd DH

# Cấu hình .env (đổi passwords, JWT secrets)
cp .env.example .env
nano .env

# Build và chạy
docker-compose -f docker-compose.prod.yml up -d --build

# Migrate + seed lần đầu
docker exec dh_backend npx prisma migrate deploy
docker exec dh_backend npm run db:seed
```

Truy cập: http://<server-ip>

---

## API Reference nhanh

| Endpoint | Mô tả |
|---|---|
| POST /api/auth/login | Đăng nhập |
| GET /api/auth/me | Thông tin user hiện tại |
| GET /api/sites | Danh sách trạm |
| POST /api/sites/import | Import Excel trạm |
| GET /api/sites/export | Export Excel trạm |
| GET /api/solutions | Danh sách giải pháp |
| GET /api/periods | Danh sách kỳ thực hiện |
| POST /api/periods/:id/generate-workorders | Sinh Work Order tự động |
| GET /api/work-orders | Danh sách Work Orders (có filter) |
| PUT /api/work-orders/:id | Cập nhật Work Order |
| GET /api/work-orders/export | Export Excel Work Orders |
| GET /api/dashboard/summary | Tổng hợp KPI |

---

## Cấu trúc dự án

```
e:\DEV\DH\
  backend/          NestJS API
    src/
      auth/         JWT authentication
      users/        Quản lý người dùng  
      sites/        Danh mục trạm
      solutions/    Danh mục giải pháp
      periods/      Kỳ thực hiện
      work-orders/  Work Orders
      dashboard/    Dashboard aggregation
    prisma/
      schema.prisma Database schema
      seed.ts       Seed data
  frontend/         React + Vite app
    src/
      pages/        Các trang
      api/          API client
      hooks/        Custom hooks
      types/        TypeScript types
  docker-compose.yml       Dev
  docker-compose.prod.yml  Production
```

---

## Mở rộng Phase 2

Các tính năng sẽ làm tiếp:
- Map trạm (Leaflet + OpenStreetMap) 
- Realtime updates (Socket.io)
- Upload ảnh thi công (MinIO)
- Audit log
- Thông báo Telegram/Email
