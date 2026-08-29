-- CreateTable ttkvs
CREATE TABLE "ttkvs" (
  "id"        SERIAL NOT NULL,
  "code"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ttkvs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ttkvs_code_key" ON "ttkvs"("code");

-- Seed 7 TTKV codes
INSERT INTO "ttkvs" ("code", "name") VALUES
  ('TĐC', 'Tân Định - Chợ'),
  ('PTO', 'Phú Thọ - Ông Tạ'),
  ('GĐH', 'Gò Dầu - Hóc Môn'),
  ('SGN', 'Sài Gòn'),
  ('TSG', 'Tân Sơn Ghì'),
  ('NSG', 'Nam Sài Gòn'),
  ('BSG', 'Bình Sơn Ghì')
ON CONFLICT ("code") DO NOTHING;

-- Add ttkvId column to sites
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "ttkvId" INTEGER;

-- Populate ttkvId from old ttkv string column (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'ttkv'
  ) THEN
    UPDATE "sites" s
    SET "ttkvId" = t.id
    FROM "ttkvs" t
    WHERE s.ttkv = t.code;

    ALTER TABLE "sites" DROP COLUMN "ttkv";
  END IF;
END $$;

-- Add FK constraint
ALTER TABLE "sites"
  ADD CONSTRAINT "sites_ttkvId_fkey"
  FOREIGN KEY ("ttkvId") REFERENCES "ttkvs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
