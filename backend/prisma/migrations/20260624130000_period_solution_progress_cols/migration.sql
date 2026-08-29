-- Cấu hình riêng từng cột tiến độ thi công trên Sheet, thay cho 1 cột bắt đầu
-- (sheetProgressStartCol cũ giả định 7 cột liên tiếp — không phù hợp khi Sheet
-- có thứ tự cột khác nhau giữa các giải pháp).
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetPlanDateCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetExecutorCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetInstallCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetPhotoCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetIntegrationCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetNoteCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetIssueCol" TEXT;
