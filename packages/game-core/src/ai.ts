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

export type AiDifficulty = "easy" | "medium" | "hard";

/** Trumps are worth holding on to, so they sort as more valuable. */
function value(card: Card, trumpSuit: GameState["trumpSuit"]): number {
  return card.rank + (isTrump(card, trumpSuit) ? 100 : 0);
}

function cheapest(cards: Card[], trumpSuit: GameState["trumpSuit"]): Card | null {
  if (cards.length === 0) return null;
  return cards.slice().sort((a, b) => value(a, trumpSuit) - value(b, trumpSuit))[0]!;
}

function costliest(cards: Card[], trumpSuit: GameState["trumpSuit"]): Card | null {
  if (cards.length === 0) return null;
  return cards.slice().sort((a, b) => value(b, trumpSuit) - value(a, trumpSuit))[0]!;
}

function shouldTransfer(
  state: GameState,
  player: PlayerId,
  transfers: Card[],
  beaters: Card[],
  difficulty: AiDifficulty,
): Card | null {
  if (transfers.length === 0) return null;

  const nextDef = seatAfter(state, player, true);
  const nextHand = handOf(state, nextDef).length;
  const nextLow = nextHand <= 2;

  if (difficulty === "easy") {
    if (beaters.length === 0) return cheapest(transfers, state.trumpSuit);
    return null;
  }

  if (difficulty === "hard") {
    if (beaters.length === 0 || nextLow || nextHand >= 4) {
      return costliest(transfers, state.trumpSuit) ?? cheapest(transfers, state.trumpSuit);
    }
    return null;
  }

  // medium — original heuristic
  if (beaters.length === 0 || nextLow) {
    return cheapest(transfers, state.trumpSuit);
  }
  return null;
}

function shouldThrowIn(
  state: GameState,
  candidate: Card | null,
  defenderLow: boolean,
  difficulty: AiDifficulty,
): boolean {
  if (!candidate) return false;

  if (difficulty === "easy") {
    return state.takeInProgress || (defenderLow && candidate.rank <= 6);
  }

  if (difficulty === "hard") {
    return state.takeInProgress || defenderLow || candidate.rank <= 11;
  }

  return state.takeInProgress || defenderLow || candidate.rank <= 9;
}

function openingAttackCard(
  legal: Card[],
  trumpSuit: GameState["trumpSuit"],
  difficulty: AiDifficulty,
): Card | null {
  const nonTrump = legal.filter((c) => !isTrump(c, trumpSuit));
  if (difficulty === "easy" && nonTrump.length > 0) {
    return cheapest(nonTrump, trumpSuit);
  }
  if (difficulty === "hard" && nonTrump.length > 0) {
    return costliest(nonTrump, trumpSuit);
  }
  return cheapest(legal, trumpSuit);
}

function pickDefenderMove(
  state: GameState,
  player: PlayerId,
  difficulty: AiDifficulty,
): Move | null {
  if (state.takeInProgress) return null;
  const undef = undefendedPairs(state);
  if (undef.length === 0) return null;

  const target = undef[0]!;
  const transfers = legalTransfers(state, target);
  const beaters = legalDefenses(state, target);

  const transferCard = shouldTransfer(state, player, transfers, beaters, difficulty);
  if (transferCard) {
    return { type: "TRANSFER", player, card: transferCard, target };
  }

  if (difficulty === "easy" && beaters.length > 0) {
    const allTrumps = beaters.every((c) => isTrump(c, state.trumpSuit));
    const cheapestBeat = cheapest(beaters, state.trumpSuit);
    if (allTrumps && cheapestBeat && cheapestBeat.rank >= 10 && undef.length >= 2) {
      return { type: "TAKE", player };
    }
  }

  const card = cheapest(beaters, state.trumpSuit);
  if (!card) {
    return { type: "TAKE", player };
  }
  return { type: "DEFEND", player, card, target };
}

function pickAttackerMove(
  state: GameState,
  player: PlayerId,
  difficulty: AiDifficulty,
): Move | null {
  const legal = legalAttacks(state, player);

  if (state.table.length === 0) {
    if (player !== state.attackerId) return null;
    const card = openingAttackCard(legal, state.trumpSuit, difficulty);
    return card ? { type: "ATTACK", player, card } : null;
  }

  const nonTrump = legal.filter((c) => !isTrump(c, state.trumpSuit));
  const defenderLow = handOf(state, state.defenderId).length <= 2;

  if (canPass(state, player)) {
    const candidate = cheapest(nonTrump, state.trumpSuit);
    if (shouldThrowIn(state, candidate, defenderLow, difficulty)) {
      return { type: "ATTACK", player, card: candidate! };
    }
    return { type: "PASS", player };
  }

  const candidate = cheapest(nonTrump, state.trumpSuit);
  if (shouldThrowIn(state, candidate, defenderLow, difficulty)) {
    return { type: "ATTACK", player, card: candidate! };
  }
  return null;
}

/**
 * Picks a move for an AI-controlled player, or returns null when this player
 * currently has nothing to do (e.g. waiting on the defender). The driver should
 * keep polling players until someone can act.
 */
export function pickMove(
  state: GameState,
  player: PlayerId,
  difficulty: AiDifficulty = "medium",
): Move | null {
  if (state.phase !== "playing") return null;
  if (handOf(state, player).length === 0) return null;

  if (player === state.defenderId) {
    return pickDefenderMove(state, player, difficulty);
  }

  return pickAttackerMove(state, player, difficulty);
}

/** Convenience: the set of players an AI driver controls (everyone except humans). */
export function aiSeats(state: GameState, humans: PlayerId[]): PlayerId[] {
  return state.players.filter((p) => !humans.includes(p));
}

export { attackers };
