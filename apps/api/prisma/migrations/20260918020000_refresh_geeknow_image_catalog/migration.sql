-- Pro and VIP were evaluated locally but never became public product models, so
-- remove their temporary configuration instead of retaining disabled entries.
DELETE FROM "provider_channels"
WHERE "model_id" IN ('gpt-image-2-pro', 'gpt-image-2-vip');

DELETE FROM "model_definitions"
WHERE "id" IN ('gpt-image-2-pro', 'gpt-image-2-vip');

-- Flare and Sunburst use the same documented size matrix. dimensionTiers keeps
-- the exact WxH sent to GeekNow in sync with the selected resolution and ratio.
UPDATE "model_definitions"
SET
  "enabled" = true,
  "capabilities" = '{"verified":true,"dimensions":[{"ratio":"1:1","width":1024,"height":1024},{"ratio":"4:3","width":1536,"height":1152},{"ratio":"3:2","width":1536,"height":1024},{"ratio":"2:3","width":1024,"height":1536},{"ratio":"16:9","width":1920,"height":1080},{"ratio":"9:16","width":1080,"height":1920}],"dimensionTiers":{"1K":[{"ratio":"1:1","width":1024,"height":1024},{"ratio":"4:3","width":1536,"height":1152},{"ratio":"3:2","width":1536,"height":1024},{"ratio":"2:3","width":1024,"height":1536},{"ratio":"16:9","width":1920,"height":1080},{"ratio":"9:16","width":1080,"height":1920}],"2K":[{"ratio":"1:1","width":2048,"height":2048},{"ratio":"4:3","width":2048,"height":1536},{"ratio":"3:2","width":2560,"height":1712},{"ratio":"2:3","width":1712,"height":2560},{"ratio":"16:9","width":2048,"height":1152},{"ratio":"9:16","width":1152,"height":2048}],"4K":[{"ratio":"1:1","width":2880,"height":2880},{"ratio":"4:3","width":3840,"height":2880},{"ratio":"3:2","width":3840,"height":2560},{"ratio":"2:3","width":2560,"height":3840},{"ratio":"16:9","width":3840,"height":2160},{"ratio":"9:16","width":2160,"height":3840}]},"qualities":["低画质","标准画质","高画质","超高画质","极致画质","自动"],"resolutions":["1K","2K","4K"],"counts":[1]}'::jsonb,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN ('gpt-image-2.5-flare', 'gpt-image-2.5-sunburst');

-- Keep stable product IDs and user-facing Nano Banana names while the GeekNow
-- channels point at its currently available preview model identifiers.
INSERT INTO "model_definitions"
  ("id", "kind", "label", "maker", "description", "is_auto", "enabled", "capabilities")
VALUES
  (
    'gemini-3.1-flash-image',
    'image',
    'Nano Banana 2',
    'Google',
    '兼顾生成速度、参考图一致性与文字渲染的通用图片模型',
    false,
    true,
    '{"verified":true,"dimensions":[{"ratio":"1:1","width":1024,"height":1024},{"ratio":"1:4","width":512,"height":2048},{"ratio":"1:8","width":256,"height":2048},{"ratio":"2:3","width":1024,"height":1536},{"ratio":"3:2","width":1536,"height":1024},{"ratio":"3:4","width":1152,"height":1536},{"ratio":"4:1","width":2048,"height":512},{"ratio":"4:3","width":1536,"height":1152},{"ratio":"4:5","width":1280,"height":1600},{"ratio":"5:4","width":1600,"height":1280},{"ratio":"8:1","width":2048,"height":256},{"ratio":"9:16","width":1152,"height":2048},{"ratio":"16:9","width":2048,"height":1152},{"ratio":"21:9","width":2240,"height":960}],"qualities":[],"resolutions":["1K"],"counts":[1]}'::jsonb
  ),
  (
    'gemini-3-pro-image',
    'image',
    'Nano Banana Pro',
    'Google',
    '面向复杂设计、精确文字与专业视觉资产的高质量图片模型',
    false,
    true,
    '{"verified":true,"dimensions":[{"ratio":"1:1","width":2048,"height":2048},{"ratio":"1:4","width":768,"height":3072},{"ratio":"1:8","width":512,"height":4096},{"ratio":"2:3","width":1712,"height":2560},{"ratio":"3:2","width":2560,"height":1712},{"ratio":"3:4","width":1536,"height":2048},{"ratio":"4:1","width":3072,"height":768},{"ratio":"4:3","width":2048,"height":1536},{"ratio":"4:5","width":1792,"height":2240},{"ratio":"5:4","width":2240,"height":1792},{"ratio":"8:1","width":4096,"height":512},{"ratio":"9:16","width":1152,"height":2048},{"ratio":"16:9","width":2048,"height":1152},{"ratio":"21:9","width":2688,"height":1152}],"qualities":[],"resolutions":["1K","2K"],"counts":[1]}'::jsonb
  )
ON CONFLICT ("id") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "label" = EXCLUDED."label",
  "maker" = EXCLUDED."maker",
  "description" = EXCLUDED."description",
  "enabled" = true,
  "capabilities" = EXCLUDED."capabilities",
  "updated_at" = CURRENT_TIMESTAMP;

-- Extreme panoramic ratios do not fit the compact canvas parameter selector.
-- Keep the product surface focused on ratios that can be previewed clearly.
UPDATE "model_definitions"
SET "capabilities" = jsonb_set(
  "capabilities",
  '{dimensions}',
  COALESCE(
    (
      SELECT jsonb_agg("dimension")
      FROM jsonb_array_elements("capabilities"->'dimensions') AS "dimension"
      WHERE "dimension"->>'ratio' NOT IN ('1:4', '1:8', '4:1', '8:1')
    ),
    '[]'::jsonb
  )
)
WHERE "id" IN ('gemini-3.1-flash-image', 'gemini-3-pro-image');

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
  'channel.geeknow.image.' || "model"."id",
  'provider.geeknow',
  'gemini-generate-content',
  "model"."id",
  "variant"."remote_model",
  'GeekNow · ' || "model"."label",
  'https://api.geeknow.ai',
  "model"."capabilities" || '{"referenceImages":true}'::jsonb,
  200,
  "variant"."priority",
  true
FROM "model_definitions" AS "model"
JOIN (
  VALUES
    ('gemini-3.1-flash-image', 'gemini-3.1-flash-image-preview', 2),
    ('gemini-3-pro-image', 'gemini-3-pro-image-preview', 3)
) AS "variant"("id", "remote_model", "priority") ON "variant"."id" = "model"."id"
ON CONFLICT ("id") DO UPDATE SET
  "protocol" = EXCLUDED."protocol",
  "remote_model" = EXCLUDED."remote_model",
  "label" = EXCLUDED."label",
  "base_url" = EXCLUDED."base_url",
  "capabilities" = EXCLUDED."capabilities",
  "weight" = EXCLUDED."weight",
  "priority" = EXCLUDED."priority",
  "enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;

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
  'channel.geeknow.image.' || "model"."id",
  'provider.geeknow',
  'openai-image',
  "model"."id",
  "model"."id",
  'GeekNow · ' || "model"."label",
  'https://api.geeknow.ai/v1',
  "model"."capabilities" || '{"referenceImages":true,"referenceTransport":"json"}'::jsonb,
  200,
  "variant"."priority",
  true
FROM "model_definitions" AS "model"
JOIN (
  VALUES
    ('gpt-image-2.5-flare', 4),
    ('gpt-image-2.5-sunburst', 5)
) AS "variant"("id", "priority") ON "variant"."id" = "model"."id"
ON CONFLICT ("id") DO UPDATE SET
  "protocol" = EXCLUDED."protocol",
  "remote_model" = EXCLUDED."remote_model",
  "label" = EXCLUDED."label",
  "base_url" = EXCLUDED."base_url",
  "capabilities" = EXCLUDED."capabilities",
  "weight" = EXCLUDED."weight",
  "priority" = EXCLUDED."priority",
  "enabled" = true,
  "updated_at" = CURRENT_TIMESTAMP;
