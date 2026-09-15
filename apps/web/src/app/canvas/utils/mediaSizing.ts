export type MediaCapabilityKind = "image" | "video";

export interface MediaDimensionOption {
  ratio: string;
  width: number;
  height: number;
}

export type MediaCapabilityCatalog = Record<
  MediaCapabilityKind,
  { fallback: MediaDimensionOption[]; models: Record<string, MediaDimensionOption[]> }
>;

const COMMON_DIMENSIONS: MediaDimensionOption[] = [
  { ratio: "1:1", width: 1024, height: 1024 },
  { ratio: "1:2", width: 768, height: 1536 },
  { ratio: "2:1", width: 1536, height: 768 },
  { ratio: "9:16", width: 1080, height: 1920 },
  { ratio: "16:9", width: 1920, height: 1080 },
  { ratio: "3:4", width: 960, height: 1280 },
  { ratio: "4:3", width: 1280, height: 960 },
  { ratio: "3:2", width: 1536, height: 1024 },
  { ratio: "2:3", width: 1024, height: 1536 },
  { ratio: "5:4", width: 1280, height: 1024 },
  { ratio: "4:5", width: 1024, height: 1280 },
  { ratio: "21:9", width: 2560, height: 1080 },
  { ratio: "9:21", width: 1080, height: 2560 },
];

/** 后端接入后可传入同结构的模型能力目录，画布与选择组件无需修改。 */
export const FALLBACK_MEDIA_CAPABILITIES: MediaCapabilityCatalog = {
  image: { fallback: COMMON_DIMENSIONS, models: {} },
  video: { fallback: COMMON_DIMENSIONS, models: {} },
};

export function getMediaDimensions(
  kind: MediaCapabilityKind,
  model: string,
  catalog: MediaCapabilityCatalog = FALLBACK_MEDIA_CAPABILITIES,
) {
  return catalog[kind].models[model] ?? catalog[kind].fallback;
}

/** 按模型真实输出尺寸缩放卡片：1024 方图更紧凑，大尺寸媒体长边不超过 300px。 */
export function getMediaCardSize(option: MediaDimensionOption) {
  const sourceWidth = Math.max(1, option.width);
  const sourceHeight = Math.max(1, option.height);
  const scale = Math.min(200 / 1024, 300 / Math.max(sourceWidth, sourceHeight));
  return {
    w: Math.max(80, Math.round(sourceWidth * scale)),
    h: Math.max(80, Math.round(sourceHeight * scale)),
  };
}
