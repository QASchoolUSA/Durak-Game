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
  | "purple"
  | "blue"
  | "red"
  | "charcoal"
  | "obsidian"
  | "navy"
  | "plum"
  | "pine"
  | "sienna"
  | "indigo";

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

// Dark theme tokens
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

// Desaturated dark theme tokens
const CHARCOAL_TOP = "#2D3238";
const CHARCOAL_BOTTOM = "#1B1E22";
const CHARCOAL_BACK = "#353A40";
const CHARCOAL_BACK_LIGHT = "#424850";
const CHARCOAL_ACCENT = "#8E959E";

const OBSIDIAN_TOP = "#1E1F22";
const OBSIDIAN_BOTTOM = "#0D0E10";
const OBSIDIAN_BACK = "#25262B";
const OBSIDIAN_BACK_LIGHT = "#313239";
const OBSIDIAN_ACCENT = "#767881";

const NAVY_TOP = "#243642";
const NAVY_BOTTOM = "#141E26";
const NAVY_BACK = "#2C3E4C";
const NAVY_BACK_LIGHT = "#384C5C";
const NAVY_ACCENT = "#7F9CB5";

// New desaturated dark theme tokens
const PLUM_TOP = "#4E243D";
const PLUM_BOTTOM = "#2A1120";
const PLUM_BACK = "#5B2C49";
const PLUM_BACK_LIGHT = "#723A5D";
const PLUM_ACCENT = "#BD89AA";

const PINE_TOP = "#1C2D27";
const PINE_BOTTOM = "#0D1815";
const PINE_BACK = "#243B33";
const PINE_BACK_LIGHT = "#2F4F44";
const PINE_ACCENT = "#76A394";

const SIENNA_TOP = "#3D221A";
const SIENNA_BOTTOM = "#20110C";
const SIENNA_BACK = "#4F2B20";
const SIENNA_BACK_LIGHT = "#63392B";
const SIENNA_ACCENT = "#BD7D6A";

const INDIGO_TOP = "#22273D";
const INDIGO_BOTTOM = "#111420";
const INDIGO_BACK = "#2C3352";
const INDIGO_BACK_LIGHT = "#384169";
const INDIGO_ACCENT = "#808EC4";

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
  charcoal: {
    id: "charcoal",
    name: "Charcoal Lounge",
    tagline: "Slate felt, desaturated graphite backs",
    mode: "dark",
    table: {
      backgroundColor: CHARCOAL_TOP,
      backgroundGradient: [CHARCOAL_TOP, CHARCOAL_BOTTOM],
    },
    card: {
      face: "#F5F6F8",
      faceEdge: "#CCD0D6",
      back: CHARCOAL_BACK,
      backLight: CHARCOAL_BACK_LIGHT,
      backAccent: CHARCOAL_ACCENT,
      suitRed: "#C62828",
      suitBlack: "#1E2022",
      backPattern: "weave",
    },
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian Felt",
    tagline: "Jet black felt, silver-grey backs",
    mode: "dark",
    table: {
      backgroundColor: OBSIDIAN_TOP,
      backgroundGradient: [OBSIDIAN_TOP, OBSIDIAN_BOTTOM],
    },
    card: {
      face: "#F4F4F6",
      faceEdge: "#C8C8CC",
      back: OBSIDIAN_BACK,
      backLight: OBSIDIAN_BACK_LIGHT,
      backAccent: OBSIDIAN_ACCENT,
      suitRed: "#E53935",
      suitBlack: "#111215",
      backPattern: "sunburst",
    },
  },
  navy: {
    id: "navy",
    name: "Steel Navy",
    tagline: "Muted steel blue felt, slate wave backs",
    mode: "dark",
    table: {
      backgroundColor: NAVY_TOP,
      backgroundGradient: [NAVY_TOP, NAVY_BOTTOM],
    },
    card: {
      face: "#F4F7F9",
      faceEdge: "#C8D4DD",
      back: NAVY_BACK,
      backLight: NAVY_BACK_LIGHT,
      backAccent: NAVY_ACCENT,
      suitRed: "#C62828",
      suitBlack: "#171D22",
      backPattern: "seal",
    },
  },
  plum: {
    id: "plum",
    name: "Midnight Plum",
    tagline: "Deep plum felt, orchid seal backs",
    mode: "dark",
    table: {
      backgroundColor: PLUM_TOP,
      backgroundGradient: [PLUM_TOP, PLUM_BOTTOM],
    },
    card: {
      face: "#FAF2F6",
      faceEdge: "#E8C8DC",
      back: PLUM_BACK,
      backLight: PLUM_BACK_LIGHT,
      backAccent: PLUM_ACCENT,
      suitRed: "#C62828",
      suitBlack: "#251520",
      backPattern: "seal",
    },
  },
  pine: {
    id: "pine",
    name: "Nordic Pine",
    tagline: "Deep forest felt, sage pine backs",
    mode: "dark",
    table: {
      backgroundColor: PINE_TOP,
      backgroundGradient: [PINE_TOP, PINE_BOTTOM],
    },
    card: {
      face: "#F3F7F5",
      faceEdge: "#C2D1CB",
      back: PINE_BACK,
      backLight: PINE_BACK_LIGHT,
      backAccent: PINE_ACCENT,
      suitRed: "#C62828",
      suitBlack: "#161E1B",
      backPattern: "crest",
    },
  },
  sienna: {
    id: "sienna",
    name: "Sienna Hearth",
    tagline: "Warm terracotta felt, copper sunburst backs",
    mode: "dark",
    table: {
      backgroundColor: SIENNA_TOP,
      backgroundGradient: [SIENNA_TOP, SIENNA_BOTTOM],
    },
    card: {
      face: "#FBF2F0",
      faceEdge: "#E5CBC2",
      back: SIENNA_BACK,
      backLight: SIENNA_BACK_LIGHT,
      backAccent: SIENNA_ACCENT,
      suitRed: "#B71C1C",
      suitBlack: "#221613",
      backPattern: "sunburst",
    },
  },
  indigo: {
    id: "indigo",
    name: "Twilight Room",
    tagline: "Midnight indigo felt, steel weave backs",
    mode: "dark",
    table: {
      backgroundColor: INDIGO_TOP,
      backgroundGradient: [INDIGO_TOP, INDIGO_BOTTOM],
    },
    card: {
      face: "#F2F4FB",
      faceEdge: "#C2CADF",
      back: INDIGO_BACK,
      backLight: INDIGO_BACK_LIGHT,
      backAccent: INDIGO_ACCENT,
      suitRed: "#C62828",
      suitBlack: "#151822",
      backPattern: "weave",
    },
  },
};

export const APPEARANCE_ORDER: AppearanceId[] = [
  "green",
  "purple",
  "blue",
  "red",
  "charcoal",
  "obsidian",
  "navy",
  "plum",
  "pine",
  "sienna",
  "indigo",
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
  return null;
}

export function isValidAppearanceId(value: string): value is AppearanceId {
  return resolveAppearanceId(value) !== null;
}
