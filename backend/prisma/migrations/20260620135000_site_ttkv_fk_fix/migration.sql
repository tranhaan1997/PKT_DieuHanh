-- Drop FK first (depends on ttkvs_code_key), then drop redundant unique index, then recreate FK pointing to PK
ALTER TABLE "sites" DROP CONSTRAINT IF EXISTS "sites_ttkvCode_fkey";
DROP INDEX IF EXISTS "ttkvs_code_key";
ALTER TABLE "sites" ADD CONSTRAINT "sites_ttkvCode_fkey"
  FOREIGN KEY ("ttkvCode") REFERENCES "ttkvs"("code") ON UPDATE CASCADE ON DELETE SET NULL;

-- AlterTable
ALTER TABLE "system_configs" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ttkvs" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "work_orders" ALTER COLUMN "officeUpdatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "techUpdatedAt" SET DATA TYPE TIMESTAMP(3);
