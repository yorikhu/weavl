export const PLACEMENTS = { right: 0, left: 1, center: 2, full: 3 } as const;
export const MATERIALS = { pearl: 0, chrome: 1, satin: 2 } as const;
export const INTERACTIONS = { none: 0, repel: 1, attract: 2 } as const;
export const EFFECTS = { none: 0, dither: 1, ascii: 2 } as const;
export const FLOWS = { stream: 0, vortex: 1, ribbon: 2 } as const;

export const RIPPLE_SPEED = 4.2;
export const RIPPLE_TAIL = 1.8;
export const SHARD_BASE_WORLD_SIZE = 0.0125;

export const MATERIAL_PRESETS = {
  pearl: { roughness: 0.46, brightness: 0.92, glow: 0.54, highlightMix: 0.78 },
  chrome: { roughness: 0.1, brightness: 1.12, glow: 0.38, highlightMix: 0.9 },
  satin: { roughness: 0.74, brightness: 0.84, glow: 0.42, highlightMix: 0.66 }
} as const;

export const DETAIL_PRESETS = {
  bold: { count: 0.58, size: 1.32 },
  balanced: { count: 1, size: 0.96 },
  fine: { count: 1.15, size: 0.7 }
} as const;

export const QUALITY_PRESETS = {
  low: { count: 1900, dpr: 1.5, supersamplePixels: 3000000 },
  medium: { count: 3200, dpr: 2, supersamplePixels: 6000000 },
  high: { count: 4600, dpr: 2, supersamplePixels: 8000000 }
} as const;

export const RUNTIME_QUALITY = [{ countScale: 1 }, { countScale: 0.86 }, { countScale: 0.72 }] as const;

// Only the halo is downsampled. Shard edges keep their display-resolution detail.
export const BLOOM_SCALES = [0.25, 0.22, 0.18] as const;

export const FRAME_STATES = {
  interactive: { interval: 1000 / 60, continuous: true },
  settling: { interval: 1000 / 60, continuous: true },
  ambient: { interval: 1000 / 60, continuous: true },
  partial: { interval: 1000 / 12, continuous: false }
} as const;
