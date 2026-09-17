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

/**
 * 计算当前渲染状态允许的帧间隔。
 *
 * @param frameState - 当前帧调度状态。
 * @param refreshInterval - 目标刷新间隔。
 * @returns 最终帧间隔。
 */
export const resolveFrameInterval = (frameState: FrameState, refreshInterval: number): number =>
  frameState.continuous ? Math.max(frameState.interval, refreshInterval) : frameState.interval;

/**
 * 推进下一帧截止时间并纠正过期时间。
 *
 * @param timestamp - 当前时间戳。
 * @param deadline - 原下一帧截止时间。
 * @param interval - 帧间隔。
 * @param reset - 是否重置调度。
 * @returns 下一帧时间戳。
 */
export const advanceFrameDeadline = (timestamp: number, deadline: number, interval: number, reset: boolean): number => {
  const nextDeadline = deadline + interval;
  return reset || nextDeadline <= timestamp - 0.5 ? timestamp + interval : nextDeadline;
};

/**
 * 将数值限制在指定区间。
 *
 * @param value - 待限制数值。
 * @param min - 最小值。
 * @param max - 最大值。
 * @returns 限制后的数值。
 */
export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Resolves the shard's fixed CSS-pixel scale from the renderer's initial height.
 *
 * @param shardSize - User-configured shard size multiplier.
 * @param referenceHeight - Canvas CSS height captured when the renderer starts.
 * @returns The base half-size in CSS pixels.
 */
export const resolveFixedShardPixelSize = (shardSize: number, referenceHeight: number): number =>
  SHARD_BASE_WORLD_SIZE * shardSize * Math.max(referenceHeight, 1) * 0.5;

/**
 * 创建指定流向的初始编队状态。
 *
 * @param flow - 布局流向值。
 * @returns 新的编队状态。
 */
export const createFormation = (flow: number) => ({ weights: layoutVector(flow), velocity: [0, 0, 0, 0] as Vector4 });

/**
 * 按阻尼曲线推进编队权重。
 *
 * @param state - 可变编队状态。
 * @param flow - 布局流向值。
 * @param elapsed - 本帧经过时间。
 * @param duration - 过渡持续时间。
 * @param frozen - 是否直接冻结到目标状态。
 * @returns 无返回值；传入状态会被原地更新。
 */
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

/**
 * 估算当前布局权重下的碎片路径长度。
 *
 * @param aspect - 画布宽高比。
 * @param weights - 布局混合权重。
 * @returns 归一化路径长度。
 */
export const resolvePathLength = (aspect: number, weights: number[]) => {
  const side = 2.65 + 0.61 * aspect + 0.09 * aspect * aspect;
  const center = 2.3 + 2 * aspect + 0.35 * aspect * aspect;
  const full = Math.hypot(2.44 * aspect, Math.sqrt(5));
  const mobile = Math.hypot(2.56 * aspect, 1);
  return aspect < 0.82
    ? mobile * (weights[0]! + weights[1]! + weights[2]!) + full * weights[3]!
    : side * (weights[0]! + weights[1]!) + center * weights[2]! + full * weights[3]!;
};

/**
 * 创建指针长按交互状态。
 *
 * @returns 新的长按状态。
 */
export const createHold = (): HoldState => ({ pointerId: null, elapsed: 0, amount: 0, velocity: 0, phase: 0 });

/**
 * 推进长按强度和动画相位。
 *
 * @param hold - 可变长按状态。
 * @param elapsed - 本帧经过时间。
 * @param disabled - 是否禁用交互。
 * @returns 无返回值；传入状态会被原地更新。
 */
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

/**
 * 重置指针运动状态。
 *
 * @param pointer - 可变指针状态。
 * @returns 无返回值；传入状态会被原地更新。
 */
export const resetPointerMotion = (pointer: PointerState): void => {
  pointer.velocity ??= [0, 0];
  pointer.velocity[0] = 0;
  pointer.velocity[1] = 0;
  pointer.presenceVelocity = 0;
};

/**
 * 按当前指针输入推进交互运动。
 *
 * @param pointer - 可变指针状态。
 * @param elapsed - 本帧经过时间。
 * @returns 无返回值；传入状态会被原地更新。
 */
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

/**
 * 创建固定容量的涟漪状态池。
 *
 * @returns 新的涟漪状态数组。
 */
export const createRipples = (): RippleState[] =>
  Array.from({ length: 4 }, () => ({ origin: [0.5, 0.5], age: 0, duration: 0, strength: 0 }));

/**
 * 在状态池中启动一次涟漪。
 *
 * @param ripples - 涟漪状态池。
 * @param origin - 计算参数。
 * @param aspect - 画布宽高比。
 * @param strength - 计算参数。
 * @returns 无返回值；选中的涟漪状态会被原地更新。
 */
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

/**
 * 推进全部活跃涟漪并回收已结束项。
 *
 * @param ripples - 涟漪状态池。
 * @param elapsed - 本帧经过时间。
 * @param disabled - 是否禁用交互。
 * @returns 无返回值；涟漪状态会被原地更新。
 */
export const advanceRipples = (ripples: RippleState[], elapsed: number, disabled: boolean): void => {
  for (const ripple of ripples) {
    if (disabled) ripple.strength = 0;
    if (!ripple.strength) continue;
    ripple.age += elapsed;
    if (ripple.age >= ripple.duration) ripple.strength = 0;
  }
};

/**
 * 将布局流向映射为四维混合权重。
 *
 * @param placement - 计算参数。
 * @returns 布局混合权重。
 */
export const layoutVector = (placement: number): Vector4 => [0, 1, 2, 3].map(index => (index === placement ? 1 : 0)) as Vector4;

/**
 * 按比例混合两种颜色。
 *
 * @param from - 计算参数。
 * @param to - 计算参数。
 * @param amount - 混合比例。
 * @returns 混合后的 RGB 颜色。
 */
export const mixColor = (from: Color, to: Color, amount: number): Color => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
  1
];

/**
 * 将 CSS 十六进制颜色解析为 RGB。
 *
 * @param value - 待限制数值。
 * @param fallback - 计算参数。
 * @returns 归一化 RGB 颜色。
 */
export const parseColor = (value: string, fallback: string): Color => {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  const source = match || /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(fallback)!;
  return [parseInt(source[1]!, 16) / 255, parseInt(source[2]!, 16) / 255, parseInt(source[3]!, 16) / 255, 1];
};

/**
 * 解析动画质量档位及自动降级结果。
 *
 * @param canvas - 计算参数。
 * @returns 最终质量预设。
 */
export const resolveQuality = (canvas: HTMLCanvasElement): Quality => {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 6;
  const cores = navigator.hardwareConcurrency || 6;
  const cssPixels = Math.max(1, canvas.clientWidth * canvas.clientHeight);
  if (canvas.clientWidth < 640 || memory <= 4 || cores <= 4) return 'low';
  if (cssPixels <= 360000 && memory >= 8 && cores >= 12) return 'high';
  return 'medium';
};

/**
 * 根据质量预设限制设备像素比。
 *
 * @param preset - 质量预设。
 * @param canvas - 计算参数。
 * @returns 渲染使用的设备像素比。
 */
export const resolveDpr = (preset: QualityPreset, canvas: HTMLCanvasElement): number => {
  const cssPixels = Math.max(1, canvas.clientWidth * canvas.clientHeight);
  // The budget limits supersampling, never the one-pixel-per-CSS-pixel base image.
  const budgetDpr = Math.sqrt(preset.supersamplePixels / cssPixels);
  return Math.max(1, Math.min(window.devicePixelRatio || 1, preset.dpr, budgetDpr));
};

/**
 * 计算 Bloom 缓冲区尺寸。
 *
 * @param size - 计算参数。
 * @param qualityLevel - 计算参数。
 * @returns Bloom 缓冲区宽高。
 */
export const resolveBloomSize = (size: readonly [number, number], qualityLevel = 0): [number, number] => {
  const bloomScale = BLOOM_SCALES[qualityLevel] ?? BLOOM_SCALES[0];
  return [Math.max(1, Math.round(size[0] * bloomScale)), Math.max(1, Math.round(size[1] * bloomScale))];
};
