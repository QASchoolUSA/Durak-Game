import type { Card, Suit } from "@durak/game-core";

/** Non-trump suits left-to-right; trump suit grouped on the right. */
const SUIT_ORDER: Suit[] = ["clubs", "diamonds", "hearts", "spades"];

/**
 * Display order for the human hand:
 * - Non-trump suits grouped together (clubs → diamonds → hearts → spades)
 * - Within each suit: rank ascending (6 … A)
 * - All trump-suit cards grouped last, also ascending by rank
 */
export function sortHandForDisplay(cards: Card[], trumpSuit: Suit): Card[] {
  return [...cards].sort((a, b) => {
    const aTrump = a.suit === trumpSuit;
    const bTrump = b.suit === trumpSuit;

    if (aTrump !== bTrump) return aTrump ? 1 : -1;

    if (a.suit !== b.suit) {
      return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    }

    return a.rank - b.rank;
  });
}
