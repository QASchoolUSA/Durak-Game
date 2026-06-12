import {
  APPEARANCE_ORDER,
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  type AppearanceId,
  type CardBackPattern,
} from "./appearanceThemes";

export interface CardTheme {
  id: CardDesignId;
  name: string;
  tagline: string;
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

export type CardDesignId = AppearanceId;

export const DEFAULT_CARD_DESIGN: CardDesignId = DEFAULT_APPEARANCE;

function buildCardTheme(id: AppearanceId): CardTheme {
  const preset = APPEARANCE_PRESETS[id];
  return {
    id,
    name: preset.name,
    tagline: preset.tagline,
    ...preset.card,
  };
}

export const CARD_THEMES: Record<CardDesignId, CardTheme> = Object.fromEntries(
  APPEARANCE_ORDER.map((id) => [id, buildCardTheme(id)]),
) as Record<CardDesignId, CardTheme>;

export const CARD_DESIGN_ORDER: CardDesignId[] = APPEARANCE_ORDER;

export function getCardTheme(id: CardDesignId): CardTheme {
  return CARD_THEMES[id] ?? CARD_THEMES[DEFAULT_CARD_DESIGN];
}

export const MENU_CARD_THEME: CardTheme = getCardTheme("green");

export function resolveCardDesignId(value: string): CardDesignId | null {
  if (value in CARD_THEMES) return value as CardDesignId;
  return null;
}

export function isValidCardDesignId(value: string): value is CardDesignId {
  return resolveCardDesignId(value) !== null;
}
