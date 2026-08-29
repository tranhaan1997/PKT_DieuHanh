-- Add performance indexes for common filter/join columns

-- WorkOrder: filter by period, site, solution, and period+status combo
CREATE INDEX IF NOT EXISTS "work_orders_periodId_idx" ON "work_orders"("periodId");
CREATE INDEX IF NOT EXISTS "work_orders_siteId_idx" ON "work_orders"("siteId");
CREATE INDEX IF NOT EXISTS "work_orders_solutionId_idx" ON "work_orders"("solutionId");
CREATE INDEX IF NOT EXISTS "work_orders_periodId_installationStatus_idx" ON "work_orders"("periodId", "installationStatus");

-- Site: filter by ttkv and province
CREATE INDEX IF NOT EXISTS "sites_ttkvCode_idx" ON "sites"("ttkvCode");
CREATE INDEX IF NOT EXISTS "sites_province_idx" ON "sites"("province");
