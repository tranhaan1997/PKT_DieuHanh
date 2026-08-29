ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetStartRow" INTEGER;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetSiteCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetWrittenCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetActCol" TEXT;
ALTER TABLE "period_solutions" ADD COLUMN IF NOT EXISTS "sheetTtkvCol" TEXT;
