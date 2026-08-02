export const MIN_SCALE = 0.2;
export const MAX_SCALE = 2.2;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}
