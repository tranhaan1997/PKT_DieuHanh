-- Lịch sử các lượt đồng bộ trạng thái viết phiếu tự động (audit cho an toàn)
CREATE TYPE "AutoSyncStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

CREATE TABLE IF NOT EXISTS "auto_sync_runs" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "status" "AutoSyncStatus" NOT NULL,
    "periodsProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalUpdated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "auto_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auto_sync_runs_startedAt_idx" ON "auto_sync_runs"("startedAt" DESC);
