import type { Card, GameState, PlayerId } from "@durak/game-core";

export function sanitizeGameState(state: GameState, viewerPlayerId: PlayerId): GameState {
  const hands: Record<PlayerId, Card[]> = {};
  for (const p of state.players) {
    const count = state.hands[p]?.length ?? 0;
    if (p === viewerPlayerId) {
      hands[p] = (state.hands[p] ?? []).slice();
    } else {
      hands[p] = Array.from({ length: count }, (_, i) => ({
        id: `hidden-${p}-${i}`,
        suit: "spades" as const,
        rank: 6 as const,
      }));
    }
  }
  return {
    ...state,
    hands,
    // Keep deck length for UI counts; only index 0 (face-up trump) is real.
    deck: state.deck.map((c, i) =>
      i === 0
        ? { id: `deck-${i}`, suit: c.suit, rank: c.rank }
        : { id: `hidden-deck-${i}`, suit: "spades" as const, rank: 6 as const },
    ),
    // Discard faces stay visible for the graveyard skill.
  };
}

export function memberNames(
  members: { displayName: string; playerId?: string; isBot: boolean }[],
): Record<PlayerId, string> {
  const names: Record<PlayerId, string> = {};
  for (const m of members) {
    if (m.playerId) names[m.playerId] = m.displayName;
  }
  return names;
}
