import { colors } from "./index";

export type CardBackPattern = "crest" | "seal" | "weave" | "sunburst";

export interface CardPalette {
  face: string;
  faceEdge: string;
  back: string;
  backLight?: string;
  backAccent: string;
  backAccentSoft?: string;
  suitRed: string;
  suitBlack: string;
  backPattern: CardBackPattern;
}

export interface TablePalette {
  backgroundColor: string;
  backgroundGradient?: [string, string];
}

export type AppearanceId =
  | "green"
  | "greenDay"
  | "purple"
  | "purpleDay"
  | "blue"
  | "blueDay"
  | "red"
  | "redDay";

export type AppearanceMode = "light" | "dark";

export interface AppearancePreset {
  id: AppearanceId;
  name: string;
  tagline: string;
  mode: AppearanceMode;
  table: TablePalette;
  card: CardPalette;
}

export const DEFAULT_APPEARANCE: AppearanceId = "green";

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const GREEN_BACK = "#0E3D2C";
const GREEN_BACK_LIGHT = "#145238";
const GREEN_ACCENT = "#6BCF9A";

const PURPLE_TOP = "#6B3FA0";
const PURPLE_BOTTOM = "#2D1B4E";
const PURPLE_BACK = "#3D2463";
const PURPLE_BACK_LIGHT = "#4A2E75";
const PURPLE_ACCENT = "#C4B5FD";

const BLUE_TOP = "#2563A8";
const BLUE_BOTTOM = "#0F2847";
const BLUE_BACK = "#15324A";
const BLUE_BACK_LIGHT = "#1A3D5C";
const BLUE_ACCENT = "#7CB8E8";

const RED_TOP = "#9B2335";
const RED_BOTTOM = "#4A1219";
const RED_BACK = "#5C1A24";
const RED_BACK_LIGHT = "#6E222E";
const RED_ACCENT = "#F0A0A8";

// ── Day (light) theme tokens ──────────────────────────────────────────────────
const GREEN_DAY_TOP = "#3BA87A";
const GREEN_DAY_BOTTOM = "#14724F";
const GREEN_DAY_BACK = "#F4F1E8";
const GREEN_DAY_BACK_LIGHT = "#FAF7F0";
const GREEN_DAY_ACCENT = "#0F5A3C";
const GREEN_DAY_ACCENT_SOFT = "#6BCF9A";

const PURPLE_DAY_TOP = "#A88BD4";
const PURPLE_DAY_BOTTOM = "#6B3FA0";
const PURPLE_DAY_BACK = "#F5F0FA";
const PURPLE_DAY_BACK_LIGHT = "#FBF8FD";
const PURPLE_DAY_ACCENT = "#5B3A8C";
const PURPLE_DAY_ACCENT_SOFT = "#9B7BC4";

const BLUE_DAY_TOP = "#5A9FD4";
const BLUE_DAY_BOTTOM = "#2563A8";
const BLUE_DAY_BACK = "#F0F5FA";
const BLUE_DAY_BACK_LIGHT = "#F8FAFD";
const BLUE_DAY_ACCENT = "#1A5080";
const BLUE_DAY_ACCENT_SOFT = "#4A90C4";

const RED_DAY_TOP = "#D46A7A";
const RED_DAY_BOTTOM = "#9B2335";
const RED_DAY_BACK = "#FBF2F0";
const RED_DAY_BACK_LIGHT = "#FFF8F6";
const RED_DAY_ACCENT = "#8B2230";
const RED_DAY_ACCENT_SOFT = "#C45A6A";

/** Maps removed appearance ids to the nearest preset. */
export const LEGACY_APPEARANCE: Record<string, AppearanceId> = {
  classic: "green",
  velvet: "green",
  emeraldNight: "green",
  golden: "greenDay",
  emeraldDay: "greenDay",
  linenDay: "greenDay",
  sunlit: "greenDay",
  arcticDay: "blueDay",
  espressoNight: "purple",
  graphiteNight: "blue",
  royal: "purple",
  tavern: "purple",
  ember: "purple",
  walnut: "purple",
  midnight: "blue",
  onyx: "blue",
  noir: "blue",
  void: "blue",
  slate: "blue",
  minimal: "blue",
};

export const APPEARANCE_PRESETS: Record<AppearanceId, AppearancePreset> = {
  green: {
    id: "green",
    name: "Emerald Table",
    tagline: "Brand felt, mint crest backs",
    mode: "dark",
    table: {
      backgroundColor: colors.feltTop,
      backgroundGradient: [colors.feltTop, colors.feltBottom],
    },
    card: {
      face: colors.cardFace,
      faceEdge: colors.cardFaceEdge,
      back: GREEN_BACK,
      backLight: GREEN_BACK_LIGHT,
      backAccent: GREEN_ACCENT,
      suitRed: "#C62828",
      suitBlack: "#1A2E24",
      backPattern: "crest",
    },
  },
  greenDay: {
    id: "greenDay",
    name: "Emerald Day",
    tagline: "Sunlit felt, paper crest backs",
    mode: "light",
    table: {
      backgroundColor: GREEN_DAY_TOP,
      backgroundGradient: [GREEN_DAY_TOP, GREEN_DAY_BOTTOM],
    },
    card: {
      face: colors.cardFace,
      faceEdge: colors.cardFaceEdge,
      back: GREEN_DAY_BACK,
      backLight: GREEN_DAY_BACK_LIGHT,
      backAccent: GREEN_DAY_ACCENT,
      backAccentSoft: GREEN_DAY_ACCENT_SOFT,
      suitRed: "#C62828",
      suitBlack: "#1A2E24",
      backPattern: "crest",
    },
  },
  purple: {
    id: "purple",
    name: "Royal Velvet",
    tagline: "Deep purple felt, royal seal backs",
    mode: "dark",
    table: {
      backgroundColor: PURPLE_TOP,
      backgroundGradient: [PURPLE_TOP, PURPLE_BOTTOM],
    },
    card: {
      face: "#F6F2FA",
      faceEdge: "#D8CCE8",
      back: PURPLE_BACK,
      backLight: PURPLE_BACK_LIGHT,
      backAccent: PURPLE_ACCENT,
      suitRed: "#C62828",
      suitBlack: "#1A2E24",
      backPattern: "seal",
    },
  },
  purpleDay: {
    id: "purpleDay",
    name: "Lilac Day",
    tagline: "Soft lilac felt, paper seal backs",
    mode: "light",
    table: {
      backgroundColor: PURPLE_DAY_TOP,
      backgroundGradient: [PURPLE_DAY_TOP, PURPLE_DAY_BOTTOM],
    },
    card: {
      face: "#F6F2FA",
      faceEdge: "#D8CCE8",
      back: PURPLE_DAY_BACK,
      backLight: PURPLE_DAY_BACK_LIGHT,
      backAccent: PURPLE_DAY_ACCENT,
      backAccentSoft: PURPLE_DAY_ACCENT_SOFT,
      suitRed: "#C62828",
      suitBlack: "#1A2E24",
      backPattern: "seal",
    },
  },
  blue: {
    id: "blue",
    name: "Sapphire Room",
    tagline: "Casino blue felt, woven lattice backs",
    mode: "dark",
    table: {
      backgroundColor: BLUE_TOP,
      backgroundGradient: [BLUE_TOP, BLUE_BOTTOM],
    },
    card: {
      face: "#F5F8FC",
      faceEdge: "#C8D8E8",
      back: BLUE_BACK,
      backLight: BLUE_BACK_LIGHT,
      backAccent: BLUE_ACCENT,
      suitRed: "#D7263D",
      suitBlack: "#20232A",
      backPattern: "weave",
    },
  },
  blueDay: {
    id: "blueDay",
    name: "Sky Day",
    tagline: "Bright sky felt, paper weave backs",
    mode: "light",
    table: {
      backgroundColor: BLUE_DAY_TOP,
      backgroundGradient: [BLUE_DAY_TOP, BLUE_DAY_BOTTOM],
    },
    card: {
      face: "#F5F8FC",
      faceEdge: "#C8D8E8",
      back: BLUE_DAY_BACK,
      backLight: BLUE_DAY_BACK_LIGHT,
      backAccent: BLUE_DAY_ACCENT,
      backAccentSoft: BLUE_DAY_ACCENT_SOFT,
      suitRed: "#D7263D",
      suitBlack: "#20232A",
      backPattern: "weave",
    },
  },
  red: {
    id: "red",
    name: "Crimson Lounge",
    tagline: "Burgundy felt, sunburst backs",
    mode: "dark",
    table: {
      backgroundColor: RED_TOP,
      backgroundGradient: [RED_TOP, RED_BOTTOM],
    },
    card: {
      face: "#FFF5F2",
      faceEdge: "#E8C8C0",
      back: RED_BACK,
      backLight: RED_BACK_LIGHT,
      backAccent: RED_ACCENT,
      suitRed: "#C62828",
      suitBlack: "#1A2E24",
      backPattern: "sunburst",
    },
  },
  redDay: {
    id: "redDay",
    name: "Rose Day",
    tagline: "Rose felt, paper sunburst backs",
    mode: "light",
    table: {
      backgroundColor: RED_DAY_TOP,
      backgroundGradient: [RED_DAY_TOP, RED_DAY_BOTTOM],
    },
    card: {
      face: "#FFF5F2",
      faceEdge: "#E8C8C0",
      back: RED_DAY_BACK,
      backLight: RED_DAY_BACK_LIGHT,
      backAccent: RED_DAY_ACCENT,
      backAccentSoft: RED_DAY_ACCENT_SOFT,
      suitRed: "#C62828",
      suitBlack: "#1A2E24",
      backPattern: "sunburst",
    },
  },
};

export const APPEARANCE_ORDER: AppearanceId[] = [
  "green",
  "greenDay",
  "purple",
  "purpleDay",
  "blue",
  "blueDay",
  "red",
  "redDay",
];

export function getTableSwatchColor(table: TablePalette): string {
  return table.backgroundGradient?.[0] ?? table.backgroundColor;
}

export function getAppearance(id: AppearanceId): AppearancePreset {
  return APPEARANCE_PRESETS[id] ?? APPEARANCE_PRESETS[DEFAULT_APPEARANCE];
}

export function resolveAppearanceId(value: string): AppearanceId | null {
  if (value in APPEARANCE_PRESETS) {
    return value as AppearanceId;
  }
  const legacy = LEGACY_APPEARANCE[value];
  if (legacy) {
    return legacy;
  }
  return null;
}

export function isValidAppearanceId(value: string): value is AppearanceId {
  return resolveAppearanceId(value) !== null;
}
