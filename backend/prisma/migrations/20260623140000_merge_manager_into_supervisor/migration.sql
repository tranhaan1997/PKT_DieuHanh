-- Gộp role MANAGER vào SUPERVISOR (đổi tên hiển thị "Quản lý" -> "Điều hành")
UPDATE "users" SET "role" = 'SUPERVISOR' WHERE "role" = 'MANAGER';

BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'VIEWER');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'TECHNICIAN';
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;
