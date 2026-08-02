import type { CanvasPosition } from "@/types";

export const ROOT_BUBBLE_SIZE = 260;
export const MIN_BUBBLE_SIZE = 72;
export const SIZE_DECAY = 0.74;

/** Bubble diameter (px) for a given depth in the tree. Root is depth 0. */
export function bubbleSizeForDepth(depth: number): number {
  const size = ROOT_BUBBLE_SIZE * Math.pow(SIZE_DECAY, depth);
  return Math.max(MIN_BUBBLE_SIZE, Math.round(size));
}

/**
 * Root bubbles anchor independent conversation trees ("topics"). Space them
 * out generously in a single row — each tree can fan its own descendants
 * out radially, so rows need enough clearance that two topics' subtrees
 * never collide.
 */
const ROOT_SPACING = 1600;

export function computeRootPosition(index: number): CanvasPosition {
  return { x: index * ROOT_SPACING, y: 0 };
}

/**
 * Computes a resting position for a new child bubble on the canvas, fanning
 * children out and away from their grandparent direction so the tree grows
 * outward without stacking bubbles on top of each other.
 */
export function computeChildPosition(
  parentPosition: CanvasPosition,
  parentDepth: number,
  grandparentPosition: CanvasPosition | null,
  siblingIndex: number,
  siblingCount: number,
): CanvasPosition {
  const parentSize = bubbleSizeForDepth(parentDepth);
  const childSize = bubbleSizeForDepth(parentDepth + 1);
  const padding = 64 + siblingCount * 6;
  const distance = parentSize / 2 + childSize / 2 + padding;

  let awayAngle = -Math.PI / 2; // default: fan upward
  if (grandparentPosition) {
    const dx = parentPosition.x - grandparentPosition.x;
    const dy = parentPosition.y - grandparentPosition.y;
    if (dx !== 0 || dy !== 0) {
      awayAngle = Math.atan2(dy, dx);
    }
  }

  const spread = Math.min(Math.PI * 1.5, 0.9 + siblingCount * 0.5);
  const start = awayAngle - spread / 2;
  const step = siblingCount > 1 ? spread / (siblingCount - 1) : 0;
  const angle = siblingCount === 1 ? awayAngle : start + step * siblingIndex;

  return {
    x: parentPosition.x + Math.cos(angle) * distance,
    y: parentPosition.y + Math.sin(angle) * distance,
  };
}
