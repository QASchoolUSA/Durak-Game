/**
 * Pure responsive layout math — reference canvas 390×844 logical pts (iPhone 14-class).
 * No React imports; safe for unit tests.
 */

import { PixelRatio } from "react-native";

/** Matches theme CARD_ASPECT — kept local to avoid circular imports. */
const CARD_ASPECT = 1.4;

const BASE_TYPOGRAPHY = {
  hero: 58,
  display: 34,
  title: 22,
  heading: 17,
  body: 14,
  caption: 12,
  label: 9,
  micro: 8,
} as const;

export const REF_WIDTH = 390;
export const REF_HEIGHT = 844;

export const BASE_CARD_SIZES = {
  hand: 82,
  table: 72,
  small: 48,
  fan: 68,
} as const;

export const MIN_CARD_W = {
  hand: 74,
  table: 62,
  small: 42,
  fan: 60,
} as const;

export const SCALE_MIN = 0.88;
export const SCALE_MAX_PHONE = 1.08;
export const SCALE_MAX_TABLET = 1.25;
export const SCALE_MAX_LARGE = 1.4;

/** @deprecated Use sizeClass === "tablet" | "large" */
export const SCALE_MAX = SCALE_MAX_PHONE;
export const TABLET_BREAKPOINT = 768;
export const LARGE_BREAKPOINT = 1024;

export type SizeClass = "compact" | "regular" | "tablet" | "large";

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface CardDimensions {
  w: number;
  h: number;
}

export interface GameLayoutInput {
  width: number;
  height: number;
  insets: SafeAreaInsets;
}

export interface GameLayoutResult {
  scale: number;
  s: (n: number) => number;
  insets: SafeAreaInsets;
  width: number;
  height: number;
  usableWidth: number;
  usableHeight: number;
  sizeClass: SizeClass;
  isCompact: boolean;
  isTablet: boolean;
  hPad: number;
  maxContent: number;
  cardSizes: {
    hand: CardDimensions;
    table: CardDimensions;
    small: CardDimensions;
    fan: CardDimensions;
  };
  typography: {
    hero: { fontSize: number; fontWeight: "900"; letterSpacing: number };
    display: { fontSize: number; fontWeight: "900"; letterSpacing: number };
    title: { fontSize: number; fontWeight: "800"; letterSpacing: number };
    heading: { fontSize: number; fontWeight: "700"; letterSpacing: number };
    body: { fontSize: number; fontWeight: "500" };
    caption: { fontSize: number; fontWeight: "600"; letterSpacing: number };
    label: { fontSize: number; fontWeight: "800"; letterSpacing: number };
    micro: { fontSize: number; fontWeight: "700"; letterSpacing: number };
  };
}

const snap = (n: number) => PixelRatio.roundToNearestPixel(n);

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function resolveSizeClass(width: number): SizeClass {
  if (width <= 375) return "compact";
  if (width < TABLET_BREAKPOINT) return "regular";
  if (width < LARGE_BREAKPOINT) return "tablet";
  return "large";
}

function scaleMaxForSizeClass(sizeClass: SizeClass): number {
  switch (sizeClass) {
    case "tablet":
      return SCALE_MAX_TABLET;
    case "large":
      return SCALE_MAX_LARGE;
    default:
      return SCALE_MAX_PHONE;
  }
}

function hPadForSizeClass(sizeClass: SizeClass): number {
  switch (sizeClass) {
    case "tablet":
      return 32;
    case "large":
      return 40;
    default:
      return 20;
  }
}

function maxContentForSizeClass(
  sizeClass: SizeClass,
  usableWidth: number,
  width: number,
): number {
  switch (sizeClass) {
    case "tablet":
      return Math.min(Math.round(usableWidth * 0.72), 720);
    case "large":
      return Math.min(Math.round(usableWidth * 0.78), 820);
    default:
      return Math.min(width - 32, 420);
  }
}

function scaledCardSize(baseW: number, minW: number, scale: number): CardDimensions {
  const w = snap(Math.max(minW, baseW * scale));
  const h = snap(Math.round(w * CARD_ASPECT));
  return { w, h };
}

function scaledTypography(
  scale: number,
  isCompact: boolean,
  sizeClass: SizeClass,
) {
  const s = (n: number) => snap(n * scale);
  const heroMax =
    sizeClass === "large" ? 72 : sizeClass === "tablet" ? 64 : isCompact ? 48 : 58;
  const displayMax =
    sizeClass === "large" ? 42 : sizeClass === "tablet" ? 38 : isCompact ? 28 : 34;
  return {
    hero: {
      fontSize: clamp(s(BASE_TYPOGRAPHY.hero), 40, heroMax),
      fontWeight: "900" as const,
      letterSpacing: 8,
    },
    display: {
      fontSize: clamp(s(BASE_TYPOGRAPHY.display), 24, displayMax),
      fontWeight: "900" as const,
      letterSpacing: 3,
    },
    title: {
      fontSize: s(BASE_TYPOGRAPHY.title),
      fontWeight: "800" as const,
      letterSpacing: 1,
    },
    heading: {
      fontSize: s(BASE_TYPOGRAPHY.heading),
      fontWeight: "700" as const,
      letterSpacing: 0.3,
    },
    body: { fontSize: s(BASE_TYPOGRAPHY.body), fontWeight: "500" as const },
    caption: {
      fontSize: s(BASE_TYPOGRAPHY.caption),
      fontWeight: "600" as const,
      letterSpacing: 0.5,
    },
    label: {
      fontSize: s(BASE_TYPOGRAPHY.label),
      fontWeight: "800" as const,
      letterSpacing: 1.2,
    },
    micro: {
      fontSize: s(BASE_TYPOGRAPHY.micro),
      fontWeight: "700" as const,
      letterSpacing: 0.8,
    },
  };
}

export function gridColumnsForSizeClass(sizeClass: SizeClass): number {
  switch (sizeClass) {
    case "large":
      return 6;
    case "tablet":
      return 5;
    default:
      return 4;
  }
}

/** Center bottom sheets on tablet using proportional content width. */
export function sheetHorizontalFrame(
  lay: Pick<GameLayoutResult, "isTablet" | "usableWidth" | "maxContent" | "insets">,
): { left: number; right: number } {
  if (!lay.isTablet) {
    return { left: 0, right: 0 };
  }
  const gutter = Math.max(0, (lay.usableWidth - lay.maxContent) / 2);
  return {
    left: lay.insets.left + gutter,
    right: lay.insets.right + gutter,
  };
}

export function computeGameLayout(input: GameLayoutInput): GameLayoutResult {
  const { width, height, insets } = input;
  const usableWidth = width - insets.left - insets.right;
  const usableHeight = height - insets.top - insets.bottom;
  const sizeClass = resolveSizeClass(width);
  const isTablet = sizeClass === "tablet" || sizeClass === "large";
  const hPad = hPadForSizeClass(sizeClass);
  const maxContent = maxContentForSizeClass(sizeClass, usableWidth, width);
  const effectiveWidth = isTablet
    ? Math.min(usableWidth, maxContent + 2 * hPad)
    : usableWidth;

  const rawScale = Math.min(effectiveWidth / REF_WIDTH, usableHeight / REF_HEIGHT);
  const scale = clamp(rawScale, SCALE_MIN, scaleMaxForSizeClass(sizeClass));
  const s = (n: number) => snap(n * scale);
  const isCompact = sizeClass === "compact" || usableHeight < 700;

  return {
    scale,
    s,
    insets,
    width,
    height,
    usableWidth,
    usableHeight,
    sizeClass,
    isCompact,
    isTablet,
    hPad,
    maxContent,
    cardSizes: {
      hand: scaledCardSize(BASE_CARD_SIZES.hand, MIN_CARD_W.hand, scale),
      table: scaledCardSize(BASE_CARD_SIZES.table, MIN_CARD_W.table, scale),
      small: scaledCardSize(BASE_CARD_SIZES.small, MIN_CARD_W.small, scale),
      fan: scaledCardSize(BASE_CARD_SIZES.fan, MIN_CARD_W.fan, scale),
    },
    typography: scaledTypography(scale, isCompact, sizeClass),
  };
}

/** @deprecated Use useGameLayout() or computeGameLayout() instead. */
export function layoutFor(windowWidth: number) {
  const lay = computeGameLayout({
    width: windowWidth,
    height: REF_HEIGHT,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  return {
    isTablet: lay.isTablet,
    maxContent: lay.maxContent,
    cardScale: lay.scale,
    hPad: lay.hPad,
  };
}
