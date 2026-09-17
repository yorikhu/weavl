-- AlterTable
ALTER TABLE "provider_channels" ADD COLUMN "protocol" TEXT NOT NULL DEFAULT 'openai-chat';

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "channel_id" TEXT,
    "model_kind" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "remote_operation" TEXT,
    "status" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generation_jobs_owner_idx" ON "generation_jobs"("owner_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs"("status", "updated_at");

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "provider_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
