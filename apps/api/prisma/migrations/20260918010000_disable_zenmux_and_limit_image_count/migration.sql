-- Keep ZenMux configuration and history for later analysis, but remove it from all runtime routing.
UPDATE "model_providers"
SET "enabled" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'zenmux';

UPDATE "provider_channels"
SET "enabled" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE "provider_id" IN (
  SELECT "id"
  FROM "model_providers"
  WHERE "code" = 'zenmux'
);

-- During the initial release every image request produces exactly one output.
UPDATE "model_definitions"
SET
  "capabilities" = jsonb_set("capabilities", '{counts}', '[1]'::jsonb, true),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "kind" = 'image';

UPDATE "provider_channels" AS "channel"
SET
  "capabilities" = jsonb_set("channel"."capabilities", '{counts}', '[1]'::jsonb, true),
  "updated_at" = CURRENT_TIMESTAMP
FROM "model_definitions" AS "model"
WHERE "channel"."model_id" = "model"."id"
  AND "model"."kind" = 'image';
