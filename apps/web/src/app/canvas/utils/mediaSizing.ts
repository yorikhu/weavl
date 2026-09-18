import type { MediaGenerationCapabilities } from "@weavl/shared";

export type MediaCapabilityKind = "image" | "video";

export interface MediaDimensionOption {
  ratio: string;
  width: number;
  height: number;
}

export interface IntrinsicMediaSize {
  width: number;
  height: number;
}

/** 新建图片生成节点使用的默认输出规格。 */
export const DEFAULT_IMAGE_DIMENSION: MediaDimensionOption = { ratio: "3:2", width: 1536, height: 1024 };

export interface ResolvedMediaCapabilities {
  verified: boolean;
  dimensions: MediaDimensionOption[];
  dimensionTiers: Record<string, MediaDimensionOption[]>;
  qualities: string[];
  resolutions: string[];
  durations: number[];
  counts: number[];
}

const IMAGE_DIMENSIONS: MediaDimensionOption[] = [
  { ratio: "1:1", width: 1024, height: 1024 },
  DEFAULT_IMAGE_DIMENSION,
  { ratio: "2:3", width: 1024, height: 1536 },
];

const VIDEO_DIMENSIONS: MediaDimensionOption[] = [
  { ratio: "16:9", width: 1920, height: 1080 },
  { ratio: "9:16", width: 1080, height: 1920 },
];

const FALLBACKS: Record<MediaCapabilityKind, ResolvedMediaCapabilities> = {
  image: {
    verified: false,
    dimensions: IMAGE_DIMENSIONS,
    dimensionTiers: {},
    qualities: ["低画质", "标准画质", "高画质"],
    resolutions: ["1K", "2K", "4K"],
    durations: [],
    counts: [1],
  },
  video: {
    verified: false,
    dimensions: VIDEO_DIMENSIONS,
    dimensionTiers: {},
    qualities: [],
    resolutions: ["720P"],
    durations: [5, 10],
    counts: [1],
  },
};

/**
 * 合并数据库中的模型能力与安全回退值。供应商参数不完整时只暴露保守选项。
 *
 * @param kind - 图片或视频模型。
 * @param capabilities - 模型目录返回的能力配置。
 * @returns 可直接渲染为规格选择器的参数集合。
 */
export function resolveMediaCapabilities(
  kind: MediaCapabilityKind,
  capabilities?: MediaGenerationCapabilities,
): ResolvedMediaCapabilities {
  const fallback = FALLBACKS[kind];
  return {
    verified: capabilities?.verified ?? fallback.verified,
    dimensions: capabilities?.dimensions ?? fallback.dimensions,
    dimensionTiers: capabilities?.dimensionTiers ?? fallback.dimensionTiers,
    qualities: capabilities?.qualities ?? fallback.qualities,
    resolutions: capabilities?.resolutions ?? fallback.resolutions,
    durations: capabilities?.durations ?? fallback.durations,
    counts: capabilities?.counts ?? fallback.counts,
  };
}

/**
 * 返回当前比例和分辨率档位实际提交给供应商的图片尺寸。
 * 渠道未提供档位尺寸表时回退到比例本身的默认尺寸。
 */
export function getGenerationDimension(
  capabilities: ResolvedMediaCapabilities,
  ratio: string,
  resolution?: string,
) {
  const tier = resolution ? capabilities.dimensionTiers[resolution] : undefined;
  return tier?.find((item) => item.ratio === ratio) ?? capabilities.dimensions.find((item) => item.ratio === ratio);
}

/**
 * 按媒体真实比例计算画布卡片大小。
 * 横向媒体固定高度，纵向媒体固定宽度，较长的一边按原始比例自适应。
 *
 * @param option - 模型提供的真实像素尺寸。
 * @returns 用于节点数据的画布宽高。
 */
export function getMediaCardSize(option: IntrinsicMediaSize, shortSide = 180) {
  const sourceWidth = Math.max(1, option.width);
  const sourceHeight = Math.max(1, option.height);
  const scale = shortSide / Math.min(sourceWidth, sourceHeight);
  return {
    w: Math.round(sourceWidth * scale),
    h: Math.round(sourceHeight * scale),
  };
}

/**
 * 读取本地图片或视频的原始像素尺寸，供上传节点保持真实宽高比。
 *
 * @param file - 用户选择的图片或视频文件。
 * @returns 媒体尺寸；非媒体文件或无法解析时返回 `null`。
 */
export function readLocalMediaSize(file: File): Promise<IntrinsicMediaSize | null> {
  if (file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(
          image.naturalWidth > 0 && image.naturalHeight > 0
            ? { width: image.naturalWidth, height: image.naturalHeight }
            : null,
        );
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      image.src = url;
    });
  }
  if (file.type.startsWith("video/")) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(
          video.videoWidth > 0 && video.videoHeight > 0 ? { width: video.videoWidth, height: video.videoHeight } : null,
        );
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      video.src = url;
    });
  }
  return Promise.resolve(null);
}

/** 根据输出长边推导用于积分估算的分辨率档位。 */
export function getResolutionTier(option?: MediaDimensionOption) {
  const longest = Math.max(option?.width ?? 0, option?.height ?? 0);
  if (longest > 2560) return "4K";
  if (longest > 1280) return "2K";
  return "1K";
}
