-- Thêm timestamp riêng cho từng giai đoạn vật tư, phục vụ báo cáo nghẽn vật tư
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "writtenTicketAt" TIMESTAMP(3);
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "actReceivedAt" TIMESTAMP(3);
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "ttkvReceivedAt" TIMESTAMP(3);
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "siteReceivedAt" TIMESTAMP(3);
