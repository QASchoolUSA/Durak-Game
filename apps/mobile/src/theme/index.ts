/** Central design tokens so the whole game shares one cohesive, modern look. */

export const colors = {
  // Table felt (used as a vertical gradient top -> bottom).
  feltTop: "#12694B",
  feltBottom: "#0B3D2E",
  feltEdge: "#072A20",

  gold: "#E7C067",
  goldDim: "#9A7B36",

  cardFace: "#FAF7F0",
  cardFaceEdge: "#E7E0D2",
  cardBack: "#15324A",
  cardBackAccent: "#23527A",

  suitRed: "#D7263D",
  suitBlack: "#20232A",

  trumpGlow: "#F2D27A",

  textLight: "#F5F3EC",
  textMuted: "#B9C6BE",
  textDark: "#1B1B1F",

  overlay: "rgba(4, 20, 14, 0.72)",
  panel: "#0F352899",
  danger: "#E5484D",
  success: "#46A758",
};

export const radius = {
  card: 9,
  panel: 18,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 28,
};

/** Cards keep a standard playing-card aspect ratio. */
export const CARD_ASPECT = 1.4;

export const cardSize = {
  /** Cards in the human player's hand — sized for easy tap/drag targets. */
  hand: { w: 76, h: Math.round(76 * CARD_ASPECT) },
  /** Cards resting on the table. */
  table: { w: 62, h: Math.round(62 * CARD_ASPECT) },
  /** Deck pile + trump peek on the right edge. */
  small: { w: 48, h: Math.round(48 * CARD_ASPECT) },
};

export const timing = {
  /** Seconds a player has to act before the safe move is auto-played. */
  turnSeconds: 12,
  /** Pace of AI moves (ms) so the action is readable. */
  aiMoveDelayMs: 750,
};

export type SeatColor = string;
