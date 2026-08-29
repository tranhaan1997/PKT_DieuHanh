-- Thêm cột riêng cho "Ngày hoàn thành" trong cấu hình tiến độ thi công trên Sheet.
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetCompletedDateCol" TEXT;
