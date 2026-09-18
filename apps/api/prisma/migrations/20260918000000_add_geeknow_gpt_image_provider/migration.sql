-- GPT Image 2 uses GeekNow as its direct China-accessible provider.
-- ZenMux GPT Image 2 routes remain as historical configuration but are disabled.
INSERT INTO "model_providers"
  ("id", "code", "label", "api_key_env", "enabled", "metadata")
VALUES
  (
    'provider.geeknow',
    'geeknow',
    'GeekNow',
    'GEEKNOW_API_KEY',
    true,
    '{"region":"cn","protocol":"openai-compatible"}'::jsonb
  );

INSERT INTO "provider_channels"
  (
    "id",
    "provider_id",
    "protocol",
    "model_id",
    "remote_model",
    "label",
    "base_url",
    "capabilities",
    "weight",
    "priority",
    "enabled"
  )
SELECT
  'channel.geeknow.image.gpt-image-2',
  'provider.geeknow',
  'openai-image',
  'gpt-image-2',
  'gpt-image-2',
  'GeekNow · GPT Image 2',
  'https://api.geeknow.ai/v1',
  '{"verified":true,"dimensions":[{"ratio":"1:1","width":1024,"height":1024},{"ratio":"1:2","width":768,"height":1536},{"ratio":"2:1","width":1536,"height":768},{"ratio":"9:16","width":1152,"height":2048},{"ratio":"16:9","width":2048,"height":1152},{"ratio":"3:4","width":1152,"height":1536},{"ratio":"4:3","width":1536,"height":1152},{"ratio":"3:2","width":1536,"height":1024},{"ratio":"2:3","width":1024,"height":1536},{"ratio":"5:4","width":1600,"height":1280},{"ratio":"4:5","width":1280,"height":1600},{"ratio":"21:9","width":2240,"height":960},{"ratio":"9:21","width":960,"height":2240}],"qualities":[],"resolutions":[],"counts":[1],"referenceImages":true,"referenceTransport":"json"}'::jsonb,
  200,
  1,
  true
FROM "model_definitions"
WHERE "id" = 'gpt-image-2';

UPDATE "provider_channels"
SET "enabled" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN (
  'channel.zenmux.image.gpt-image-2',
  'channel.zenmux.image.gpt-image-2.edit'
);
