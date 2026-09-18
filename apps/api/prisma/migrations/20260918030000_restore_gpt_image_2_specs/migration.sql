-- GPT Image 2 supports independent quality and arbitrary WxH size controls.
-- Keep the model definition and the active GeekNow channel aligned so the
-- merged client catalog exposes both selectors and channel routing accepts them.
DO $$
DECLARE
  v_profile jsonb := '{
    "verified": true,
    "dimensions": [
      {"ratio":"1:1","width":2048,"height":2048},
      {"ratio":"1:2","width":1024,"height":2048},
      {"ratio":"2:1","width":2048,"height":1024},
      {"ratio":"9:16","width":1152,"height":2048},
      {"ratio":"16:9","width":2048,"height":1152},
      {"ratio":"3:4","width":1536,"height":2048},
      {"ratio":"4:3","width":2048,"height":1536},
      {"ratio":"3:2","width":2016,"height":1344},
      {"ratio":"2:3","width":1344,"height":2016},
      {"ratio":"5:4","width":1920,"height":1536},
      {"ratio":"4:5","width":1536,"height":1920},
      {"ratio":"21:9","width":2016,"height":864},
      {"ratio":"9:21","width":864,"height":2016}
    ],
    "dimensionTiers": {
      "1K": [
        {"ratio":"1:1","width":1024,"height":1024},
        {"ratio":"1:2","width":512,"height":1024},
        {"ratio":"2:1","width":1024,"height":512},
        {"ratio":"9:16","width":576,"height":1024},
        {"ratio":"16:9","width":1024,"height":576},
        {"ratio":"3:4","width":768,"height":1024},
        {"ratio":"4:3","width":1024,"height":768},
        {"ratio":"3:2","width":1008,"height":672},
        {"ratio":"2:3","width":672,"height":1008},
        {"ratio":"5:4","width":960,"height":768},
        {"ratio":"4:5","width":768,"height":960},
        {"ratio":"21:9","width":1008,"height":432},
        {"ratio":"9:21","width":432,"height":1008}
      ],
      "2K": [
        {"ratio":"1:1","width":2048,"height":2048},
        {"ratio":"1:2","width":1024,"height":2048},
        {"ratio":"2:1","width":2048,"height":1024},
        {"ratio":"9:16","width":1152,"height":2048},
        {"ratio":"16:9","width":2048,"height":1152},
        {"ratio":"3:4","width":1536,"height":2048},
        {"ratio":"4:3","width":2048,"height":1536},
        {"ratio":"3:2","width":2016,"height":1344},
        {"ratio":"2:3","width":1344,"height":2016},
        {"ratio":"5:4","width":1920,"height":1536},
        {"ratio":"4:5","width":1536,"height":1920},
        {"ratio":"21:9","width":2016,"height":864},
        {"ratio":"9:21","width":864,"height":2016}
      ],
      "4K": [
        {"ratio":"1:1","width":2880,"height":2880},
        {"ratio":"1:2","width":1920,"height":3840},
        {"ratio":"2:1","width":3840,"height":1920},
        {"ratio":"9:16","width":2160,"height":3840},
        {"ratio":"16:9","width":3840,"height":2160},
        {"ratio":"3:4","width":2880,"height":3840},
        {"ratio":"4:3","width":3840,"height":2880},
        {"ratio":"3:2","width":3840,"height":2560},
        {"ratio":"2:3","width":2560,"height":3840},
        {"ratio":"5:4","width":3600,"height":2880},
        {"ratio":"4:5","width":2880,"height":3600},
        {"ratio":"21:9","width":3696,"height":1584},
        {"ratio":"9:21","width":1584,"height":3696}
      ]
    },
    "qualities": ["低画质", "标准画质", "高画质", "自动"],
    "resolutions": ["1K", "2K", "4K"],
    "counts": [1]
  }'::jsonb;
BEGIN
  UPDATE "model_definitions"
  SET
    "capabilities" = v_profile,
    "updated_at" = CURRENT_TIMESTAMP
  WHERE "id" = 'gpt-image-2';

  UPDATE "provider_channels"
  SET
    "capabilities" = v_profile || '{"referenceImages":true,"referenceTransport":"json"}'::jsonb,
    "updated_at" = CURRENT_TIMESTAMP
  WHERE "id" = 'channel.geeknow.image.gpt-image-2';
END $$;
