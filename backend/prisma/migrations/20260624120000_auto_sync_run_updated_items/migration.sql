-- Lưu chi tiết phiếu đã cập nhật trong mỗi lượt đồng bộ tự động (xem trong modal)
ALTER TABLE "auto_sync_runs" ADD COLUMN IF NOT EXISTS "updatedItems" JSONB;
