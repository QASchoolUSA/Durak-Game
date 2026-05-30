import type { Card, Rank, Suit } from "./types";

export const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];

/** 36-card deck: 6 through Ace. */
export const RANKS: readonly Rank[] = [6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: "\u2660",
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
};

export const RANK_LABELS: Record<Rank, string> = {
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function cardId(rank: Rank, suit: Suit): string {
  return `${rank}-${suit}`;
}

/** Builds an ordered 36-card deck. */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank, id: cardId(rank, suit) });
    }
  }
  return cards;
}

/**
 * Deterministic PRNG (mulberry32). A seed makes shuffles reproducible, which is
 * essential for unit tests and for a future server that needs to replay games.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a new, shuffled copy of the deck using Fisher-Yates. */
export function shuffle(deck: Card[], rng: () => number): Card[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
