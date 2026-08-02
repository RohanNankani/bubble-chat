import { describe, it, expect } from "vitest";
import { bubbleSizeForDepth, computeChildPosition, computeRootPosition, MIN_BUBBLE_SIZE, ROOT_BUBBLE_SIZE } from "./layout";

describe("bubbleSizeForDepth", () => {
  it("returns the root size at depth 0", () => {
    expect(bubbleSizeForDepth(0)).toBe(ROOT_BUBBLE_SIZE);
  });

  it("shrinks strictly as depth increases", () => {
    const sizes = [0, 1, 2, 3, 4, 5].map(bubbleSizeForDepth);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  it("never shrinks below the minimum size", () => {
    expect(bubbleSizeForDepth(50)).toBe(MIN_BUBBLE_SIZE);
  });
});

describe("computeChildPosition", () => {
  it("places a single child away from the origin", () => {
    const pos = computeChildPosition({ x: 0, y: 0 }, 0, null, 0, 1);
    const distance = Math.hypot(pos.x, pos.y);
    expect(distance).toBeGreaterThan(0);
  });

  it("spreads multiple siblings to distinct positions", () => {
    const parent = { x: 0, y: 0 };
    const positions = [0, 1, 2].map((i) => computeChildPosition(parent, 0, null, i, 3));
    const unique = new Set(positions.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`));
    expect(unique.size).toBe(3);
  });

  it("fans children away from the grandparent direction", () => {
    const grandparent = { x: 0, y: 0 };
    const parent = { x: 300, y: 0 };
    const child = computeChildPosition(parent, 1, grandparent, 0, 1);
    // Child should continue roughly in the same direction the parent grew (positive x),
    // not double back toward the grandparent.
    expect(child.x).toBeGreaterThan(parent.x);
  });
});

describe("computeRootPosition", () => {
  it("places the first root at the origin", () => {
    expect(computeRootPosition(0)).toEqual({ x: 0, y: 0 });
  });

  it("spaces successive roots far enough apart that their subtrees can't collide", () => {
    const a = computeRootPosition(0);
    const b = computeRootPosition(1);
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    // Generous multiple of the root bubble size, since each root's own
    // descendants can fan out well beyond the bubble's own radius.
    expect(distance).toBeGreaterThan(ROOT_BUBBLE_SIZE * 4);
  });

  it("gives every root a distinct position", () => {
    const positions = [0, 1, 2, 3].map(computeRootPosition);
    const unique = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(unique.size).toBe(4);
  });
});
