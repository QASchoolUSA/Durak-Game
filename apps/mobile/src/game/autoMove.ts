import {
  type GameState,
  type Move,
  type PlayerId,
  canPass,
  canTake,
  legalAttacks,
  legalTransfers,
  undefendedPairs,
} from "@durak/game-core";

/**
 * The "safe" move played automatically when a human runs out of time:
 * a defender takes (or transfers if possible), an attacker passes,
 * and an opener plays their lowest card.
 */
export function safeMoveFor(state: GameState, player: PlayerId): Move | null {
  if (state.phase !== "playing") return null;

  if (player === state.defenderId) {
    for (const target of undefendedPairs(state)) {
      const transfers = legalTransfers(state, target);
      if (transfers.length > 0) {
        const card = transfers.slice().sort((a, b) => a.rank - b.rank)[0]!;
        return { type: "TRANSFER", player, card, target };
      }
    }
    if (canTake(state, player)) return { type: "TAKE", player };
    return null;
  }

  if (canPass(state, player)) return { type: "PASS", player };

  // Must open: play the lowest-value legal card.
  const legal = legalAttacks(state, player);
  if (legal.length > 0) {
    const card = legal
      .slice()
      .sort((a, b) => a.rank - b.rank)[0]!;
    return { type: "ATTACK", player, card };
  }
  return null;
}
