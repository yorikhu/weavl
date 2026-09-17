-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "user_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'Free',
    "credits" INTEGER NOT NULL DEFAULT 20,
    "pending_plan" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "account_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "delta" INTEGER,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_folders" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "in_library" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_versions" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "content" TEXT,
    "storage_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_folders" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "name" TEXT NOT NULL,
    "cover_url" TEXT,
    "cover_storage_key" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvases" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "viewport" JSONB NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_asset_refs" (
    "message_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,

    CONSTRAINT "message_asset_refs_pkey" PRIMARY KEY ("message_id","asset_id","version_id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "input_hint" TEXT NOT NULL,
    "output_kind" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "stages" JSONB NOT NULL DEFAULT '[]',
    "graph" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "workflow_version" INTEGER NOT NULL,
    "definition_snapshot" JSONB,
    "project_id" TEXT,
    "inputs" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "current_stage" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_providers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "api_key_env" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "pricing_adapter" TEXT,
    "pricing_url" TEXT,
    "last_price_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_definitions" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maker" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_auto" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_channels" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'openai-chat',
    "model_id" TEXT NOT NULL,
    "remote_model" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "cost_pricing" JSONB,
    "cost_currency" TEXT,
    "cost_updated_at" TIMESTAMPTZ(6),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "failure_threshold" INTEGER NOT NULL DEFAULT 3,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_price_syncs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "checksum" TEXT,
    "payload" JSONB,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "changed_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "provider_price_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_cost_versions" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "sync_id" TEXT NOT NULL,
    "pricing" JSONB NOT NULL,
    "currency" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_cost_versions_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "model_pricing_rules" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "unit_field" TEXT,
    "credits_per_unit" INTEGER NOT NULL,
    "minimum_credits" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_usages" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "job_id" TEXT,
    "model_id" TEXT NOT NULL,
    "channel_id" TEXT,
    "pricing_rule_id" TEXT,
    "status" TEXT NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "pricing_snapshot" JSONB NOT NULL,
    "credits" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger_entries" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "usage_id" TEXT,
    "type" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_policies" (
    "id" TEXT NOT NULL,
    "credit_value_cny" DECIMAL(12,6) NOT NULL,
    "markup_rate" DECIMAL(8,6) NOT NULL,
    "usd_cny_rate" DECIMAL(12,6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_request_logs" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "request_kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "status_code" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_runs" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_expiry_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "account_events_user_idx" ON "account_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "asset_folders_owner_idx" ON "asset_folders"("owner_id", "parent_id");

-- CreateIndex
CREATE INDEX "assets_owner_idx" ON "assets"("owner_id", "deleted_at", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "asset_versions_asset_idx" ON "asset_versions"("asset_id", "created_at");

-- CreateIndex
CREATE INDEX "projects_owner_idx" ON "projects"("owner_id", "deleted_at", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "canvases_project_idx" ON "canvases"("project_id", "position");

-- CreateIndex
CREATE INDEX "conversation_messages_idx" ON "conversation_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "skills_owner_idx" ON "skills"("owner_id", "visibility", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_runs_owner_idx" ON "workflow_runs"("owner_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "model_providers_code_key" ON "model_providers"("code");

-- CreateIndex
CREATE INDEX "model_definitions_kind_idx" ON "model_definitions"("kind", "enabled");

-- CreateIndex
CREATE INDEX "provider_channel_route_idx" ON "provider_channels"("model_id", "enabled", "priority");

-- CreateIndex
CREATE INDEX "provider_channel_provider_idx" ON "provider_channels"("provider_id", "enabled");

-- CreateIndex
CREATE INDEX "provider_price_syncs_provider_idx" ON "provider_price_syncs"("provider_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "channel_cost_versions_channel_idx" ON "channel_cost_versions"("channel_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "generation_jobs_owner_idx" ON "generation_jobs"("owner_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs"("status", "updated_at");

-- CreateIndex
CREATE INDEX "model_pricing_rules_route_idx" ON "model_pricing_rules"("model_id", "enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "generation_usages_job_id_key" ON "generation_usages"("job_id");

-- CreateIndex
CREATE INDEX "generation_usages_owner_idx" ON "generation_usages"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "generation_usages_model_idx" ON "generation_usages"("model_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "credit_ledger_owner_idx" ON "credit_ledger_entries"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "provider_logs_channel_idx" ON "provider_request_logs"("channel_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "legacy_runs_updated_idx" ON "legacy_runs"("updated_at" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_events" ADD CONSTRAINT "account_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_folders" ADD CONSTRAINT "asset_folders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_folders" ADD CONSTRAINT "asset_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "asset_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "asset_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_folders" ADD CONSTRAINT "project_folders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "project_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_asset_refs" ADD CONSTRAINT "message_asset_refs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_asset_refs" ADD CONSTRAINT "message_asset_refs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_asset_refs" ADD CONSTRAINT "message_asset_refs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "asset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_channels" ADD CONSTRAINT "provider_channels_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "model_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_channels" ADD CONSTRAINT "provider_channels_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_price_syncs" ADD CONSTRAINT "provider_price_syncs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "model_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_cost_versions" ADD CONSTRAINT "channel_cost_versions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "provider_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_cost_versions" ADD CONSTRAINT "channel_cost_versions_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "provider_price_syncs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "provider_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_pricing_rules" ADD CONSTRAINT "model_pricing_rules_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_usages" ADD CONSTRAINT "generation_usages_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_usages" ADD CONSTRAINT "generation_usages_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_usages" ADD CONSTRAINT "generation_usages_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_usages" ADD CONSTRAINT "generation_usages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "provider_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_usages" ADD CONSTRAINT "generation_usages_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "model_pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_usage_id_fkey" FOREIGN KEY ("usage_id") REFERENCES "generation_usages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_request_logs" ADD CONSTRAINT "provider_request_logs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "provider_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Seed stable platform configuration. Secrets remain in environment variables;
-- providers, models, routes, and billing policy are database-managed.
INSERT INTO "model_providers"
  ("id", "code", "label", "api_key_env", "pricing_adapter", "pricing_url")
VALUES
  ('provider.zenmux', 'zenmux', 'ZenMux', 'ZENMUX_API_KEY', 'zenmux-models', 'https://zenmux.ai/api/v1/models');

INSERT INTO "model_definitions"
  ("id", "kind", "label", "maker", "description", "is_auto")
VALUES
  ('deepseek-v4.1-flash', 'text', 'DeepSeek V4.1 Flash', 'DeepSeek', '高吞吐长上下文文本与视觉理解模型', false),
  ('atria-dawn-preview', 'text', 'Atria Dawn Preview (Free)', 'Atria', '面向复杂任务执行与研究工作的免费预览模型', false),
  ('ling-3.0-flash-vl', 'text', 'Ling-3.0-flash-VL', 'inclusionAI', '支持视觉理解的快速多模态模型', false),
  ('kimi-k2.8-preview', 'text', 'Kimi K2.8 Preview', 'MoonshotAI', '支持长上下文与可调推理强度的预览模型', false),
  ('gpt-image-2.5-flare', 'image', 'GPT-Image-2.5-Flare', 'OpenAI', '偏速度与高频创作的图片生成模型', false),
  ('gpt-image-2.5-sunburst', 'image', 'GPT-Image-2.5-Sunburst', 'OpenAI', '偏高质量输出的图片生成模型', false),
  ('doubao-seedance-2.0', 'video', 'Doubao-Seedance-2.0', 'ByteDance', '支持文生视频、图生视频和参考音频的视频模型', false),
  ('doubao-seedance-2.5', 'video', 'Doubao-Seedance-2.5', 'ByteDance', 'Seedance 新一代视频生成模型', false),
  ('minimax-h3-max', 'video', 'MiniMax H3 Max', 'MiniMax', '兼顾生成速度的文生视频与图生视频模型', false),
  ('wan3.0-video-prime', 'video', 'Wan3.0-Video-Prime', 'Alibaba', '支持多模态参考输入的高速视频生成模型', false);

INSERT INTO "provider_channels"
  ("id", "provider_id", "protocol", "model_id", "remote_model", "label", "base_url", "priority")
VALUES
  ('channel.zenmux.text.deepseek-v4.1-flash', 'provider.zenmux', 'openai-chat', 'deepseek-v4.1-flash', 'deepseek/deepseek-v4.1-flash', 'ZenMux · DeepSeek V4.1 Flash', 'https://zenmux.ai/api/v1', 10),
  ('channel.zenmux.text.atria-dawn-preview', 'provider.zenmux', 'openai-chat', 'atria-dawn-preview', 'atria-asi/atria-dawn-preview', 'ZenMux · Atria Dawn Preview (Free)', 'https://zenmux.ai/api/v1', 20),
  ('channel.zenmux.text.ling-3.0-flash-vl', 'provider.zenmux', 'openai-chat', 'ling-3.0-flash-vl', 'inclusionai/ling-3.0-flash-vl', 'ZenMux · Ling-3.0-flash-VL', 'https://zenmux.ai/api/v1', 30),
  ('channel.zenmux.text.kimi-k2.8-preview', 'provider.zenmux', 'openai-chat', 'kimi-k2.8-preview', 'moonshotai/kimi-k2.8-preview', 'ZenMux · Kimi K2.8 Preview', 'https://zenmux.ai/api/v1', 40),
  ('channel.zenmux.image.gpt-image-2.5-flare', 'provider.zenmux', 'vertex-image', 'gpt-image-2.5-flare', 'openai/gpt-image-2.5-flare', 'ZenMux · GPT-Image-2.5-Flare', 'https://zenmux.ai/api/vertex-ai', 10),
  ('channel.zenmux.image.gpt-image-2.5-sunburst', 'provider.zenmux', 'vertex-image', 'gpt-image-2.5-sunburst', 'openai/gpt-image-2.5-sunburst', 'ZenMux · GPT-Image-2.5-Sunburst', 'https://zenmux.ai/api/vertex-ai', 20),
  ('channel.zenmux.video.doubao-seedance-2.0', 'provider.zenmux', 'vertex-video', 'doubao-seedance-2.0', 'bytedance/doubao-seedance-2.0', 'ZenMux · Doubao-Seedance-2.0', 'https://zenmux.ai/api/vertex-ai', 10),
  ('channel.zenmux.video.doubao-seedance-2.5', 'provider.zenmux', 'vertex-video', 'doubao-seedance-2.5', 'bytedance/doubao-seedance-2.5', 'ZenMux · Doubao-Seedance-2.5', 'https://zenmux.ai/api/vertex-ai', 20),
  ('channel.zenmux.video.minimax-h3-max', 'provider.zenmux', 'vertex-video', 'minimax-h3-max', 'minimax/minimax-h3-max', 'ZenMux · MiniMax H3 Max', 'https://zenmux.ai/api/vertex-ai', 30),
  ('channel.zenmux.video.wan3.0-video-prime', 'provider.zenmux', 'vertex-video', 'wan3.0-video-prime', 'alibaba/wan3.0-video-prime', 'ZenMux · Wan3.0-Video-Prime', 'https://zenmux.ai/api/vertex-ai', 40);

UPDATE "model_definitions"
SET "capabilities" = '{"verified":true,"dimensions":[{"ratio":"1:1","width":1024,"height":1024},{"ratio":"3:2","width":1536,"height":1024},{"ratio":"2:3","width":1024,"height":1536}],"qualities":["低画质","标准画质","高画质"],"resolutions":[],"counts":[1,2,4]}'::jsonb
WHERE "id" IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst');

UPDATE "model_definitions"
SET "capabilities" = '{"verified":true,"dimensions":[{"ratio":"16:9","width":1920,"height":1080},{"ratio":"9:16","width":1080,"height":1920}],"resolutions":["480P","720P","1080P"],"durations":[5,8,10],"counts":[1]}'::jsonb
WHERE "id" = 'doubao-seedance-2.0';

UPDATE "model_definitions"
SET "capabilities" = '{"verified":false,"dimensions":[{"ratio":"16:9","width":1920,"height":1080},{"ratio":"9:16","width":1080,"height":1920}],"resolutions":["720P","1080P"],"durations":[5,8,10],"counts":[1]}'::jsonb
WHERE "id" = 'doubao-seedance-2.5';

UPDATE "model_definitions"
SET "capabilities" = '{"verified":false,"dimensions":[{"ratio":"16:9","width":1280,"height":720},{"ratio":"9:16","width":720,"height":1280}],"resolutions":["720P"],"durations":[5,10],"counts":[1]}'::jsonb
WHERE "id" = 'minimax-h3-max';

UPDATE "model_definitions"
SET "capabilities" = '{"verified":false,"dimensions":[{"ratio":"16:9","width":1920,"height":1080},{"ratio":"9:16","width":1080,"height":1920}],"resolutions":["720P","1080P"],"durations":[5,10],"counts":[1]}'::jsonb
WHERE "id" = 'wan3.0-video-prime';

INSERT INTO "billing_policies"
  ("id", "credit_value_cny", "markup_rate", "usd_cny_rate")
VALUES
  ('default', 0.035, 0.10, 7.20);
