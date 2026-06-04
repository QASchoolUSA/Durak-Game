import {
  type GameState,
  type Move,
  type PlayerId,
  canPass,
  canTake,
  legalAttacks,
} from "@durak/game-core";

/**
 * Move played when a human runs out of turn time:
 * TAKE (defender) → PASS (attacker) → lowest opening ATTACK → null.
 */
export function timeoutMoveFor(state: GameState, player: PlayerId): Move | null {
  if (state.phase !== "playing") return null;

  if (canTake(state, player)) {
    return { type: "TAKE", player };
  }

  if (canPass(state, player)) {
    return { type: "PASS", player };
  }

  if (player === state.attackerId && state.table.length === 0) {
    const legal = legalAttacks(state, player);
    if (legal.length > 0) {
      const card = legal.slice().sort((a, b) => a.rank - b.rank)[0]!;
      return { type: "ATTACK", player, card };
    }
  }

  return null;
}

/** @deprecated Use {@link timeoutMoveFor}. */
export const safeMoveFor = timeoutMoveFor;
