-- Migration: đổi PK của ttkvs từ id (Int) sang code (String)
-- và đổi FK sites.ttkvId (Int) → sites.ttkvCode (String)

-- 1. Thêm cột ttkvCode vào sites, populate từ join
ALTER TABLE sites ADD COLUMN IF NOT EXISTS "ttkvCode" TEXT;
UPDATE sites s SET "ttkvCode" = t.code FROM ttkvs t WHERE s."ttkvId" = t.id;

-- 2. Xoá FK constraint cũ trên sites.ttkvId
ALTER TABLE sites DROP CONSTRAINT IF EXISTS "sites_ttkvId_fkey";

-- 3. Xoá cột ttkvId
ALTER TABLE sites DROP COLUMN IF EXISTS "ttkvId";

-- 4. Xoá PK cũ của ttkvs (id)
ALTER TABLE ttkvs DROP CONSTRAINT IF EXISTS ttkvs_pkey;
ALTER TABLE ttkvs DROP COLUMN IF EXISTS id;

-- 5. Đặt code làm PK mới
ALTER TABLE ttkvs ADD CONSTRAINT ttkvs_pkey PRIMARY KEY (code);

-- 6. Xoá unique constraint cũ trên code (nay đã là PK)
ALTER TABLE ttkvs DROP CONSTRAINT IF EXISTS "ttkvs_code_key";

-- 7. Thêm FK mới sites.ttkvCode → ttkvs.code
ALTER TABLE sites ADD CONSTRAINT "sites_ttkvCode_fkey"
  FOREIGN KEY ("ttkvCode") REFERENCES ttkvs(code) ON UPDATE CASCADE ON DELETE SET NULL;
