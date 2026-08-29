-- Ghi nhận lần đăng nhập gần nhất của user (đăng nhập thường + SSO)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP(3);
