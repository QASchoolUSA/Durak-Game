import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  PixelRatio: {
    roundToNearestPixel: (n: number) => n,
  },
}));

import {
  computeGameLayout,
  gridColumnsForSizeClass,
  REF_HEIGHT,
  resolveSizeClass,
  sheetHorizontalFrame,
} from "./gameLayout";

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

function lay(width: number, height = REF_HEIGHT) {
  return computeGameLayout({ width, height, insets: NO_INSETS });
}

/** Portrait heights typical for tablet simulators. */
const TABLET_HEIGHT = 1024;
const LARGE_TABLET_HEIGHT = 1366;

describe("resolveSizeClass", () => {
  it("maps widths to size tiers", () => {
    expect(resolveSizeClass(320)).toBe("compact");
    expect(resolveSizeClass(390)).toBe("regular");
    expect(resolveSizeClass(768)).toBe("tablet");
    expect(resolveSizeClass(1024)).toBe("large");
  });
});

describe("computeGameLayout", () => {
  it("keeps phone baseline near reference width", () => {
    const result = lay(390);
    expect(result.sizeClass).toBe("regular");
    expect(result.scale).toBeCloseTo(1, 1);
    expect(result.maxContent).toBeLessThanOrEqual(420);
  });

  it("caps scale on sub-tablet wide phones", () => {
    const result = lay(744);
    expect(result.sizeClass).toBe("regular");
    expect(result.scale).toBeLessThanOrEqual(1.08);
    expect(result.maxContent).toBeLessThanOrEqual(420);
  });

  it("uses proportional width on tablet", () => {
    const result = lay(768, TABLET_HEIGHT);
    expect(result.sizeClass).toBe("tablet");
    expect(result.isTablet).toBe(true);
    expect(result.maxContent).toBeGreaterThan(520);
    expect(result.scale).toBeGreaterThan(1.1);
    expect(result.cardSizes.hand.w).toBeGreaterThan(82);
  });

  it("scales further on large iPad", () => {
    const tablet = lay(834, TABLET_HEIGHT);
    const large = lay(1024, LARGE_TABLET_HEIGHT);
    expect(large.sizeClass).toBe("large");
    expect(large.scale).toBeGreaterThan(tablet.scale);
    expect(large.maxContent).toBeGreaterThan(tablet.maxContent);
    expect(large.typography.hero.fontSize).toBeGreaterThanOrEqual(
      tablet.typography.hero.fontSize,
    );
  });

  it("respects compact floor on small phones", () => {
    const result = lay(320);
    expect(result.sizeClass).toBe("compact");
    expect(result.scale).toBeGreaterThanOrEqual(0.88);
  });
});

describe("gridColumnsForSizeClass", () => {
  it("returns tiered column counts", () => {
    expect(gridColumnsForSizeClass("compact")).toBe(4);
    expect(gridColumnsForSizeClass("tablet")).toBe(5);
    expect(gridColumnsForSizeClass("large")).toBe(6);
  });
});

describe("sheetHorizontalFrame", () => {
  it("centers sheets on tablet", () => {
    const result = lay(1024, LARGE_TABLET_HEIGHT);
    const frame = sheetHorizontalFrame(result);
    expect(frame.left).toBeGreaterThan(0);
    expect(frame.right).toBeGreaterThan(0);
  });

  it("uses full width on phone", () => {
    const result = lay(390);
    expect(sheetHorizontalFrame(result)).toEqual({ left: 0, right: 0 });
  });
});
