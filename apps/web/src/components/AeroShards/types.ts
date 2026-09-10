import type {
  DETAIL_PRESETS,
  EFFECTS,
  FLOWS,
  FRAME_STATES,
  INTERACTIONS,
  MATERIALS,
  PLACEMENTS,
  QUALITY_PRESETS
} from './constants';

export type Color = [number, number, number, number];
export type Vector4 = [number, number, number, number];
export type Placement = keyof typeof PLACEMENTS;
export type Material = keyof typeof MATERIALS;
export type Detail = keyof typeof DETAIL_PRESETS;
export type Interaction = keyof typeof INTERACTIONS;
export type Quality = keyof typeof QUALITY_PRESETS;
export type QualityPreset = (typeof QUALITY_PRESETS)[Quality];
export type FrameState = (typeof FRAME_STATES)[keyof typeof FRAME_STATES];

export interface AeroShardsProps {
  backgroundColor?: string;
  shardColor?: string;
  accentColor?: string;
  placement?: Placement;
  flow?: keyof typeof FLOWS;
  rippleIntensity?: number;
  holdToGather?: boolean;
  material?: Material;
  detail?: Detail;
  effect?: keyof typeof EFFECTS;
  scale?: number;
  spread?: number;
  depth?: number;
  speed?: number;
  spin?: number;
  interaction?: Interaction;
  density?: number;
  shardSize?: number;
  stretch?: number;
  turbulence?: number;
  glow?: number;
  edgeSoftness?: number;
  bloom?: number;
  grain?: number;
  chromaticAberration?: number;
  transitionDuration?: number;
  interactionRadius?: number;
  interactionStrength?: number;
  paused?: boolean;
  className?: string;
  onError?: (error: Error) => void;
}

export interface AeroSettings {
  background: Color;
  shard: Color;
  highlight: Color;
  accent: Color;
  composition: number;
  flow: number;
  rippleIntensity: number;
  holdToGather: boolean;
  effect: number;
  material: number;
  detailCount: number;
  shardSize: number;
  scale: number;
  stretch: number;
  speed: number;
  spin: number;
  turbulence: number;
  spread: number;
  depth: number;
  roughness: number;
  brightness: number;
  glow: number;
  edgeSoftness: number;
  bloom: number;
  grain: number;
  chromaticAberration: number;
  exposure: number;
  lightSurface: number;
  transitionDuration: number;
  interaction: number;
  interactionRadius: number;
  interactionStrength: number;
  paused: boolean;
  signature: string;
}

export interface PointerState {
  raw: [number, number];
  position: [number, number];
  velocity: [number, number];
  active: number;
  presence: number;
  presenceVelocity: number;
  initialized: boolean;
}

export interface HoldState {
  pointerId: number | null;
  elapsed: number;
  amount: number;
  velocity: number;
  phase: number;
}

export interface RippleState {
  origin: [number, number];
  age: number;
  duration: number;
  strength: number;
}
