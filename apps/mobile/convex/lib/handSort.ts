import type { Card, Suit } from "@durak/game-core";

const SUIT_ORDER: Suit[] = ["clubs", "diamonds", "hearts", "spades"];

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
