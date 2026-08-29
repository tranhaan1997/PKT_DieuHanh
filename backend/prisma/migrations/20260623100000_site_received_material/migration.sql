ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "siteReceivedMaterial" "MaterialStatus" NOT NULL DEFAULT 'EMPTY';
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetSiteRecvCol" TEXT;
