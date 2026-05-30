import {
  attackers,
  canPass,
  handOf,
  isTrump,
  legalAttacks,
  legalDefenses,
  legalTransfers,
  seatAfter,
  undefendedPairs,
} from "./rules";
import type { Card, GameState, Move, PlayerId } from "./types";

/** Trumps are worth holding on to, so they sort as more valuable. */
function value(card: Card, trumpSuit: GameState["trumpSuit"]): number {
  return card.rank + (isTrump(card, trumpSuit) ? 100 : 0);
}

function cheapest(cards: Card[], trumpSuit: GameState["trumpSuit"]): Card | null {
  if (cards.length === 0) return null;
  return cards.slice().sort((a, b) => value(a, trumpSuit) - value(b, trumpSuit))[0]!;
}

/**
 * Picks a move for an AI-controlled player, or returns null when this player
 * currently has nothing to do (e.g. waiting on the defender). The driver should
 * keep polling players until someone can act.
 */
export function pickMove(state: GameState, player: PlayerId): Move | null {
  if (state.phase !== "playing") return null;
  if (handOf(state, player).length === 0) return null;

  // --- Defender ---
  if (player === state.defenderId) {
    if (state.takeInProgress) return null;
    const undef = undefendedPairs(state);
    if (undef.length === 0) return null;

    const target = undef[0]!;
    const transfers = legalTransfers(state, target);
    const beaters = legalDefenses(state, target);

    if (transfers.length > 0) {
      const nextDef = seatAfter(state, player, true);
      const nextLow = handOf(state, nextDef).length <= 2;
      if (beaters.length === 0 || nextLow) {
        const card = cheapest(transfers, state.trumpSuit);
        if (card) return { type: "TRANSFER", player, card, target };
      }
    }

    const card = cheapest(beaters, state.trumpSuit);
    if (!card) {
      return { type: "TAKE", player };
    }
    return { type: "DEFEND", player, card, target };
  }

  // --- Attacker / thrower-in ---
  const legal = legalAttacks(state, player);

  // Opening attack: lead with the cheapest card.
  if (state.table.length === 0) {
    if (player !== state.attackerId) return null;
    const card = cheapest(legal, state.trumpSuit);
    return card ? { type: "ATTACK", player, card } : null;
  }

  const nonTrump = legal.filter((c) => !isTrump(c, state.trumpSuit));
  const defenderLow = handOf(state, state.defenderId).length <= 2;

  if (canPass(state, player)) {
    // Pile cheap cards on a taker, or keep pressure when the defender is short.
    const candidate = cheapest(nonTrump, state.trumpSuit);
    if (candidate && (state.takeInProgress || defenderLow || candidate.rank <= 9)) {
      return { type: "ATTACK", player, card: candidate };
    }
    return { type: "PASS", player };
  }

  // Can't pass yet (defender still owes a response) but may throw in a cheap card.
  const candidate = cheapest(nonTrump, state.trumpSuit);
  if (candidate && (state.takeInProgress || defenderLow)) {
    return { type: "ATTACK", player, card: candidate };
  }
  return null;
}

/** Convenience: the set of players an AI driver controls (everyone except humans). */
export function aiSeats(state: GameState, humans: PlayerId[]): PlayerId[] {
  return state.players.filter((p) => !humans.includes(p));
}

export { attackers };
