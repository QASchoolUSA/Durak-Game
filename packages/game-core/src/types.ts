/**
 * Core domain types for Durak (Podkidnoy + Perevodnoy variants).
 *
 * Everything here is plain, serializable data so the exact same engine can run
 * on the client (for instant UI feedback) and later on an authoritative server.
 */

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

/**
 * Ranks are stored as their comparison value so beating logic is trivial:
 * 6..10 are themselves, J=11, Q=12, K=13, A=14.
 */
export type Rank = 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
  /** Stable identity (e.g. "14-spades"), useful as a React key / animation id. */
  readonly id: string;
}

export type PlayerId = string;

/** One attack card and (optionally) the card that has beaten it. */
export interface TablePair {
  attack: Card;
  defense?: Card;
}

export type GamePhase = "playing" | "gameOver";

export type GameVariant = "podkidnoy" | "perevodnoy";

/** Who may throw in matching ranks after the opening attack. */
export type ThrowInScope = "all" | "neighbor";

/** Standard rules vs human-only ability powers (client-enforced). */
export type PlayStyle = "standard" | "abilities";

export interface GameRules {
  variant: GameVariant;
  throwInScope: ThrowInScope;
  playStyle: PlayStyle;
}

export const DEFAULT_RULES: GameRules = {
  variant: "podkidnoy",
  throwInScope: "all",
  playStyle: "standard",
};

/** Every move a player can submit. Throw-ins are just ATTACK on a non-empty table. */
export type Move =
  | { type: "ATTACK"; player: PlayerId; card: Card }
  | { type: "DEFEND"; player: PlayerId; card: Card; target: number }
  | { type: "TRANSFER"; player: PlayerId; card: Card; target: number }
  | { type: "TAKE"; player: PlayerId }
  | { type: "PASS"; player: PlayerId };

export interface GameState {
  /** Seating order around the table. Never mutated after creation. */
  readonly players: PlayerId[];
  hands: Record<PlayerId, Card[]>;
  /** Draw pile. Index 0 is the next card to be drawn; the last entry is the trump (bottom) card. */
  deck: Card[];
  readonly trumpSuit: Suit;
  /** The face-up card at the bottom of the deck that fixes the trump suit. */
  readonly trumpCard: Card;

  table: TablePair[];
  /** "Bito" - cards that have been successfully beaten and are out of play. */
  discard: Card[];

  attackerId: PlayerId;
  defenderId: PlayerId;

  /** True once the defender has declared they will take; attackers may still throw in. */
  takeInProgress: boolean;
  /** Attackers who have declared "done" this round. */
  passed: PlayerId[];

  /** Players who have run out of cards (deck empty), in the order they got out. */
  finishedOrder: PlayerId[];
  /** The "durak" (fool) - last player holding cards. null while playing or on a draw. */
  loserId: PlayerId | null;

  phase: GamePhase;
  /** Max attacking cards allowed in a single round. */
  readonly maxAttacks: number;
  /** House rules fixed for this game. */
  readonly rules: GameRules;
}
