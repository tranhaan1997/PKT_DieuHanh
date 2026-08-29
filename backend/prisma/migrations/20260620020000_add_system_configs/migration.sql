CREATE TABLE IF NOT EXISTS "system_configs" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);
