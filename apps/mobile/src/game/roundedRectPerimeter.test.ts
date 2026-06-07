import { describe, expect, it } from "vitest";
import { roundedRectPerimeter } from "./roundedRectPerimeter";

describe("roundedRectPerimeter", () => {
  it("returns 0 for non-positive dimensions", () => {
    expect(roundedRectPerimeter(0, 10, 4)).toBe(0);
    expect(roundedRectPerimeter(10, 0, 4)).toBe(0);
  });

  it("computes perimeter for a rounded rect", () => {
    const w = 100;
    const h = 40;
    const r = 10;
    const expected = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
    expect(roundedRectPerimeter(w, h, r)).toBeCloseTo(expected);
  });

  it("clamps radius to half the smaller side", () => {
    const w = 30;
    const h = 20;
    const r = 50;
    const clampedR = h / 2;
    const expected = 2 * (w - 2 * clampedR) + 2 * (h - 2 * clampedR) + 2 * Math.PI * clampedR;
    expect(roundedRectPerimeter(w, h, r)).toBeCloseTo(expected);
  });
});
