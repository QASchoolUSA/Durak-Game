import { describe, expect, it } from "vitest";
import { roundedRectPerimeter } from "./roundedRectPerimeter";
import {
  effectiveChipRadius,
  roundedRectOutlinePath,
} from "./roundedRectOutline";

describe("effectiveChipRadius", () => {
  it("clamps to half the shorter side", () => {
    expect(effectiveChipRadius(140, 38, 20)).toBe(19);
    expect(effectiveChipRadius(30, 20, 50)).toBe(10);
  });
});

describe("roundedRectOutlinePath", () => {
  it("returns null for invalid dimensions", () => {
    expect(roundedRectOutlinePath(0, 10, 20, 2.5)).toBeNull();
    expect(roundedRectOutlinePath(10, 0, 20, 2.5)).toBeNull();
  });

  it("builds a closed path starting at top center", () => {
    const outline = roundedRectOutlinePath(100, 40, 20, 2.5);
    expect(outline).not.toBeNull();
    expect(outline!.d).toMatch(/^M 50 /);
    expect(outline!.d).toContain("Z");
  });

  it("perimeter matches roundedRectPerimeter for stroke inset box", () => {
    const width = 142;
    const height = 38;
    const maxRadius = 20;
    const strokeWidth = 2.5;
    const outline = roundedRectOutlinePath(width, height, maxRadius, strokeWidth)!;
    const w = width - strokeWidth;
    const h = height - strokeWidth;
    const r = effectiveChipRadius(w, h, maxRadius);
    expect(outline.perimeter).toBeCloseTo(roundedRectPerimeter(w, h, r));
    expect(outline.radius).toBe(r);
  });
});
