/** Central design tokens — one cohesive, professional look across the whole game. */

import { PixelRatio } from "react-native";

export const colors = {
  // ── Table felt ──────────────────────────────────────────────────────────────
  feltTop:    "#14724F",
  feltMid:    "#0F5A3C",
  feltBottom: "#092E1F",
  feltEdge:   "#061A12",

  // ── Gold ────────────────────────────────────────────────────────────────────
  gold:        "#E7C067",
  goldBright:  "#F5D27A",
  goldDim:     "#9A7B36",
  goldDeep:    "#6B520E",

  // ── Cards ───────────────────────────────────────────────────────────────────
  cardFace:       "#FAF7F0",
  cardFaceEdge:   "#DDD6C5",
  cardBack:       "#15324A",
  cardBackAccent: "#1E4D72",

  // ── Suits ───────────────────────────────────────────────────────────────────
  suitRed:   "#D7263D",
  suitBlack: "#20232A",

  // ── Status ──────────────────────────────────────────────────────────────────
  trumpGlow: "#F2D27A",
  success:   "#46A758",
  danger:    "#E5484D",

  // ── Semantic aliases ─────────────────────────────────────────────────────────
  win:  "#46A758",
  lose: "#E5484D",
  draw: "#B9C6BE",

  // ── Text ────────────────────────────────────────────────────────────────────
  textLight: "#F5F3EC",
  textMuted: "#A8BAB2",
  textFaint: "#6B8078",
  textDark:  "#1B1B1F",

  // ── UI ──────────────────────────────────────────────────────────────────────
  overlay:    "rgba(4, 18, 12, 0.80)",
  overlayMid: "rgba(4, 18, 12, 0.55)",
  panel:      "rgba(9, 46, 31, 0.75)",
  panelLight: "rgba(20, 80, 55, 0.55)",
  separator:  "rgba(231, 192, 103, 0.15)",

  // ── Home screen — same felt as game/result; gold accents for decor only ─────
  homeBg: {
    top:    "#14724F",
    mid:    "#0F5A3C",
    bottom: "#092E1F",
    edge:   "#061A12",
  },
  homeDecor: {
    ring:             "rgba(231, 192, 103, 0.16)",
    ringFaint:        "rgba(231, 192, 103, 0.07)",
    diamond:          "rgba(231, 192, 103, 0.11)",
    line:             "rgba(231, 192, 103, 0.12)",
    spotlight:        "rgba(231, 192, 103, 0.06)",
    spotlightFade:    "rgba(231, 192, 103, 0.02)",
    sparkle:          "#E7C067",
    vignette:         "rgba(6, 26, 18, 0.35)",
    vignetteSoft:     "rgba(6, 26, 18, 0.22)",
    panelBg:          "#14724F",
    panelBgDeep:      "#092E1F",
    panelBorder:      "rgba(231, 192, 103, 0.28)",
    panelBorderInner: "rgba(231, 192, 103, 0.10)",
    textSub:          "#A8BAB2",
    textFaint:        "#6B8078",
  },
};

export const radius = {
  card:  9,
  panel: 20,
  pill:  999,
  sm:    6,
};

export const spacing = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  14,
  lg:  20,
  xl:  28,
  xxl: 40,
};

/** Typography scale — use directly in StyleSheet.create() style objects. */
export const typography = {
  hero:    { fontSize: 58, fontWeight: "900" as const, letterSpacing: 8  },
  display: { fontSize: 34, fontWeight: "900" as const, letterSpacing: 3  },
  title:   { fontSize: 22, fontWeight: "800" as const, letterSpacing: 1  },
  heading: { fontSize: 17, fontWeight: "700" as const, letterSpacing: 0.3 },
  body:    { fontSize: 14, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5 },
  label:   { fontSize:  9, fontWeight: "800" as const, letterSpacing: 1.2 },
  micro:   { fontSize:  8, fontWeight: "700" as const, letterSpacing: 0.8 },
};

/** Reusable shadow presets (spread as style props). */
export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.40,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  panel: {
    shadowColor: "#000",
    shadowOpacity: 0.60,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  goldGlow: {
    shadowColor: "#E7C067",
    shadowOpacity: 0.70,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  successGlow: {
    shadowColor: "#46A758",
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  dangerGlow: {
    shadowColor: "#E5484D",
    shadowOpacity: 0.65,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
};

/** Cards keep a standard playing-card aspect ratio (63 × 88 mm → 1.397). */
export const CARD_ASPECT = 1.4;

const snap = (n: number) => PixelRatio.roundToNearestPixel(n);

export const cardSize = {
  /** Cards in the human player's hand — sized for comfortable drag targets. */
  hand:  { w: snap(76), h: snap(Math.round(76 * CARD_ASPECT)) },
  /** Cards resting on the table. */
  table: { w: 62, h: Math.round(62 * CARD_ASPECT) },
  /** Deck pile + trump peek on the right edge. */
  small: { w: 48, h: Math.round(48 * CARD_ASPECT) },
  /** Decorative fan cards on the home screen. */
  fan:   { w: 68, h: Math.round(68 * CARD_ASPECT) },
};

export const timing = {
  /** Default turn timer length (overridden by Settings preference). */
  turnSeconds: 12,
};

/** Responsive layout helper — call with useWindowDimensions().width. */
export function layoutFor(windowWidth: number) {
  const isTablet = windowWidth >= 768;
  return {
    isTablet,
    maxContent: isTablet ? 520 : Math.min(windowWidth - 32, 420),
    cardScale:  isTablet ? 1.35 : 1.0,
    hPad:       isTablet ? 40 : 20,
  };
}

export type SeatColor = string;
