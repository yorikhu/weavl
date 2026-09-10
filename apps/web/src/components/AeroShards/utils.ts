import { BLOOM_SCALES, RIPPLE_SPEED, RIPPLE_TAIL, SHARD_BASE_WORLD_SIZE } from './constants';
import type {
  Color,
  FrameState,
  HoldState,
  PointerState,
  Quality,
  QualityPreset,
  RippleState,
  Vector4
} from './types';

export const resolveFrameInterval = (frameState: FrameState, refreshInterval: number): number =>
  frameState.continuous ? Math.max(frameState.interval, refreshInterval) : frameState.interval;

export const advanceFrameDeadline = (timestamp: number, deadline: number, interval: number, reset: boolean): number => {
  const nextDeadline = deadline + interval;
  return reset || nextDeadline <= timestamp - 0.5 ? timestamp + interval : nextDeadline;
};

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Converts the configured shard size into world units while preserving its initial CSS-pixel footprint.
 *
 * @param shardSize - User-configured shard size multiplier.
 * @param referenceHeight - Canvas CSS height captured when the renderer starts.
 * @param currentHeight - Current canvas CSS height.
 * @returns A world-space size compensated for the current canvas height.
 */
export const resolveFixedShardWorldSize = (
  shardSize: number,
  referenceHeight: number,
  currentHeight: number
): number =>
  SHARD_BASE_WORLD_SIZE * shardSize * (Math.max(referenceHeight, 1) / Math.max(currentHeight, 1));

export const createFormation = (flow: number) => ({ weights: layoutVector(flow), velocity: [0, 0, 0, 0] as Vector4 });

export const advanceFormation = (
  state: ReturnType<typeof createFormation>,
  flow: number,
  elapsed: number,
  duration: number,
  frozen: boolean
) => {
  const goal = layoutVector(flow);
  if (frozen) {
    state.weights = goal;
    state.velocity.fill(0);
    return;
  }
  const response = 6 / duration;
  const decay = Math.exp(-response * elapsed);
  for (let i = 0; i < 4; i += 1) {
    const offset = state.weights[i]! - goal[i]!;
    const momentum = state.velocity[i]! + response * offset;
    state.weights[i] = goal[i]! + (offset + momentum * elapsed) * decay;
    state.velocity[i] = (state.velocity[i]! - response * momentum * elapsed) * decay;
  }
  if (state.weights.every((value, i) => Math.abs(value - goal[i]!) < 0.0001 && Math.abs(state.velocity[i]!) < 0.001)) {
    state.weights = goal;
    state.velocity.fill(0);
  }
};

export const resolvePathLength = (aspect: number, weights: number[]) => {
  const side = 2.65 + 0.61 * aspect + 0.09 * aspect * aspect;
  const center = 2.3 + 2 * aspect + 0.35 * aspect * aspect;
  const full = Math.hypot(2.44 * aspect, Math.sqrt(5));
  const mobile = Math.hypot(2.56 * aspect, 1);
  return aspect < 0.82
    ? mobile * (weights[0]! + weights[1]! + weights[2]!) + full * weights[3]!
    : side * (weights[0]! + weights[1]!) + center * weights[2]! + full * weights[3]!;
};

export const createHold = (): HoldState => ({ pointerId: null, elapsed: 0, amount: 0, velocity: 0, phase: 0 });

export const advanceHold = (hold: HoldState, elapsed: number, disabled: boolean) => {
  if (disabled) {
    hold.pointerId = null;
    hold.elapsed = 0;
    hold.amount = 0;
    hold.velocity = 0;
    return;
  }
  const previousElapsed = hold.elapsed;
  hold.elapsed = hold.pointerId === null ? 0 : hold.elapsed + elapsed;
  // A short click remains a ripple. Gathering starts only after a deliberate hold.
  const engaging = hold.pointerId !== null && hold.elapsed > 0.15;
  const step = engaging && previousElapsed < 0.15 ? hold.elapsed - 0.15 : elapsed;
  const target = engaging ? 1 : 0;
  const response = engaging ? 3.8 : 3.2;
  const decay = Math.exp(-response * step);
  const offset = hold.amount - target;
  const momentum = hold.velocity + response * offset;
  hold.amount = target + (offset + momentum * step) * decay;
  hold.velocity = (hold.velocity - response * momentum * step) * decay;
  if (Math.abs(hold.amount - target) < 0.0001 && Math.abs(hold.velocity) < 0.001) {
    hold.amount = target;
    hold.velocity = 0;
  }
  if (hold.amount > 0) hold.phase += elapsed * (0.35 + hold.amount * 0.5);
};

export const resetPointerMotion = (pointer: PointerState): void => {
  pointer.velocity ??= [0, 0];
  pointer.velocity[0] = 0;
  pointer.velocity[1] = 0;
  pointer.presenceVelocity = 0;
};

export const advancePointer = (pointer: PointerState, elapsed: number): void => {
  if (elapsed <= 0) return;

  // Exact critically damped motion keeps velocity continuous through direction changes.
  const response = 26;
  const decay = Math.exp(-response * elapsed);
  for (let axis = 0; axis < 2; axis += 1) {
    const offset = pointer.position[axis]! - pointer.raw[axis]!;
    const momentum = pointer.velocity[axis]! + response * offset;
    pointer.position[axis] = pointer.raw[axis]! + (offset + momentum * elapsed) * decay;
    pointer.velocity[axis] = (pointer.velocity[axis]! - response * momentum * elapsed) * decay;
  }

  // Let the field ease into contact, then release a little more slowly.
  const presenceTarget = pointer.active ? 1 : 0;
  const presenceResponse = pointer.active ? 24 : 12;
  const presenceDecay = Math.exp(-presenceResponse * elapsed);
  const presenceOffset = pointer.presence - presenceTarget;
  const presenceMomentum = pointer.presenceVelocity + presenceResponse * presenceOffset;
  const nextPresence = presenceTarget + (presenceOffset + presenceMomentum * elapsed) * presenceDecay;
  pointer.presence = clamp(nextPresence, 0, 1);
  pointer.presenceVelocity = (pointer.presenceVelocity - presenceResponse * presenceMomentum * elapsed) * presenceDecay;

  if (nextPresence !== pointer.presence) pointer.presenceVelocity = 0;
  if (Math.abs(pointer.presence - presenceTarget) < 0.001 && Math.abs(pointer.presenceVelocity) < 0.01) {
    pointer.presence = presenceTarget;
    pointer.presenceVelocity = 0;
  }
};

export const createRipples = (): RippleState[] =>
  Array.from({ length: 4 }, () => ({ origin: [0.5, 0.5], age: 0, duration: 0, strength: 0 }));

export const startRipple = (ripples: RippleState[], origin: [number, number], aspect: number, strength = 1): boolean => {
  // Preserve waves already in flight; rapid clicks never reset a visible wave.
  const ripple = ripples.find(value => value.strength === 0);
  if (!ripple) return false;
  ripple.origin = [...origin];
  ripple.age = 0;
  const farthestX = (1 + Math.abs(origin[0] * 2 - 1)) * aspect;
  const farthestY = 1 + Math.abs(origin[1] * 2 - 1);
  ripple.duration = Math.hypot(farthestX, farthestY) / RIPPLE_SPEED + RIPPLE_TAIL;
  ripple.strength = strength;
  return true;
};

export const advanceRipples = (ripples: RippleState[], elapsed: number, disabled: boolean): void => {
  for (const ripple of ripples) {
    if (disabled) ripple.strength = 0;
    if (!ripple.strength) continue;
    ripple.age += elapsed;
    if (ripple.age >= ripple.duration) ripple.strength = 0;
  }
};

export const layoutVector = (placement: number): Vector4 => [0, 1, 2, 3].map(index => (index === placement ? 1 : 0)) as Vector4;

export const mixColor = (from: Color, to: Color, amount: number): Color => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
  1
];

export const parseColor = (value: string, fallback: string): Color => {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  const source = match || /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(fallback)!;
  return [parseInt(source[1]!, 16) / 255, parseInt(source[2]!, 16) / 255, parseInt(source[3]!, 16) / 255, 1];
};

export const resolveQuality = (canvas: HTMLCanvasElement): Quality => {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 6;
  const cores = navigator.hardwareConcurrency || 6;
  const cssPixels = Math.max(1, canvas.clientWidth * canvas.clientHeight);
  if (canvas.clientWidth < 640 || memory <= 4 || cores <= 4) return 'low';
  if (cssPixels <= 360000 && memory >= 8 && cores >= 12) return 'high';
  return 'medium';
};

export const resolveDpr = (preset: QualityPreset, canvas: HTMLCanvasElement): number => {
  const cssPixels = Math.max(1, canvas.clientWidth * canvas.clientHeight);
  // The budget limits supersampling, never the one-pixel-per-CSS-pixel base image.
  const budgetDpr = Math.sqrt(preset.supersamplePixels / cssPixels);
  return Math.max(1, Math.min(window.devicePixelRatio || 1, preset.dpr, budgetDpr));
};

export const resolveBloomSize = (size: readonly [number, number], qualityLevel = 0): [number, number] => {
  const bloomScale = BLOOM_SCALES[qualityLevel] ?? BLOOM_SCALES[0];
  return [Math.max(1, Math.round(size[0] * bloomScale)), Math.max(1, Math.round(size[1] * bloomScale))];
};
