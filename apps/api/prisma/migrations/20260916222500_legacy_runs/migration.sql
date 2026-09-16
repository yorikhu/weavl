CREATE TABLE "legacy_runs" (
  "id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "legacy_runs_updated_idx" ON "legacy_runs"("updated_at" DESC);
