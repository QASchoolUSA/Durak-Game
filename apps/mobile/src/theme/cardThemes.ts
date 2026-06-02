export type CardDesignId =
  | "classic"
  | "midnight"
  | "tavern"
  | "onyx"
  | "noir"
  | "void"
  | "ember";

export type CardBackPattern =
  | "diamond"
  | "stripe"
  | "crosshatch"
  | "dots"
  | "chevron"
  | "rings";

export interface CardTheme {
  id: CardDesignId;
  name: string;
  tagline: string;
  face: string;
  faceEdge: string;
  back: string;
  backAccent: string;
  suitRed: string;
  suitBlack: string;
  backPattern: CardBackPattern;
}

export const DEFAULT_CARD_DESIGN: CardDesignId = "classic";

/** Maps removed theme ids to their replacement for saved preferences. */
export const LEGACY_CARD_DESIGN: Record<string, CardDesignId> = {
  minimal: "onyx",
};

export const CARD_THEMES: Record<CardDesignId, CardTheme> = {
  classic: {
    id: "classic",
    name: "Classic",
    tagline: "Casino ivory on navy",
    face: "#FAF7F0",
    faceEdge: "#DDD6C5",
    back: "#15324A",
    backAccent: "#1E4D72",
    suitRed: "#D7263D",
    suitBlack: "#20232A",
    backPattern: "diamond",
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    tagline: "Cool slate, night table",
    face: "#1E2430",
    faceEdge: "#3D4F63",
    back: "#0A0E14",
    backAccent: "#2A3548",
    suitRed: "#FF6B7A",
    suitBlack: "#C8D4E0",
    backPattern: "crosshatch",
  },
  tavern: {
    id: "tavern",
    name: "Tavern",
    tagline: "Warm parchment & walnut",
    face: "#F0E6D3",
    faceEdge: "#C4A882",
    back: "#3D2817",
    backAccent: "#6B4423",
    suitRed: "#B83232",
    suitBlack: "#2C1810",
    backPattern: "stripe",
  },
  onyx: {
    id: "onyx",
    name: "Onyx",
    tagline: "Jet black & silver",
    face: "#242428",
    faceEdge: "#48484F",
    back: "#08080A",
    backAccent: "#6E6E78",
    suitRed: "#F0526E",
    suitBlack: "#E8EAEF",
    backPattern: "rings",
  },
  noir: {
    id: "noir",
    name: "Noir",
    tagline: "Stark monochrome drama",
    face: "#121214",
    faceEdge: "#2E2E32",
    back: "#000000",
    backAccent: "#3C3C40",
    suitRed: "#DC2626",
    suitBlack: "#F4F4F5",
    backPattern: "chevron",
  },
  void: {
    id: "void",
    name: "Void",
    tagline: "Deep cosmic violet",
    face: "#1A1524",
    faceEdge: "#3D3254",
    back: "#0C0814",
    backAccent: "#6D5BD0",
    suitRed: "#F472B6",
    suitBlack: "#C4B5FD",
    backPattern: "dots",
  },
  ember: {
    id: "ember",
    name: "Ember",
    tagline: "Smoldering gold & coal",
    face: "#2A2018",
    faceEdge: "#524030",
    back: "#140E08",
    backAccent: "#B87333",
    suitRed: "#FB923C",
    suitBlack: "#F5E6D3",
    backPattern: "stripe",
  },
};

export const CARD_DESIGN_ORDER: CardDesignId[] = [
  "classic",
  "tavern",
  "midnight",
  "onyx",
  "noir",
  "void",
  "ember",
];

export function getCardTheme(id: CardDesignId): CardTheme {
  return CARD_THEMES[id] ?? CARD_THEMES[DEFAULT_CARD_DESIGN];
}

export function resolveCardDesignId(value: string): CardDesignId | null {
  if (value in CARD_THEMES) {
    return value as CardDesignId;
  }
  const legacy = LEGACY_CARD_DESIGN[value];
  if (legacy) {
    return legacy;
  }
  return null;
}

export function isValidCardDesignId(value: string): value is CardDesignId {
  return resolveCardDesignId(value) !== null;
}
