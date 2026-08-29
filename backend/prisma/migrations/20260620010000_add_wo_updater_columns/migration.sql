ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "officeUpdatedById" INTEGER,
  ADD COLUMN IF NOT EXISTS "officeUpdatedAt"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "techUpdatedById"   INTEGER,
  ADD COLUMN IF NOT EXISTS "techUpdatedAt"     TIMESTAMPTZ;

ALTER TABLE "work_orders"
  DROP CONSTRAINT IF EXISTS "work_orders_officeUpdatedById_fkey",
  DROP CONSTRAINT IF EXISTS "work_orders_techUpdatedById_fkey";

ALTER TABLE "work_orders"
  ADD CONSTRAINT "work_orders_officeUpdatedById_fkey"
    FOREIGN KEY ("officeUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "work_orders_techUpdatedById_fkey"
    FOREIGN KEY ("techUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
