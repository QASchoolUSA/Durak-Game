import { canPass, canTake, canTransfer, legalAttacks, legalDefenses, undefendedPairs } from "./rules";
import type { GameState, Move, PlayerId } from "./types";

/**
 * Move played when a human runs out of turn time:
 * TAKE (defender) → PASS (attacker) → lowest opening ATTACK → null.
 * Optional throw-ins are never auto-played.
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

function hasLegalDefense(state: GameState, player: PlayerId): boolean {
  if (state.defenderId !== player || state.takeInProgress) return false;
  for (const target of undefendedPairs(state)) {
    if (legalDefenses(state, target).length > 0) return true;
  }
  return false;
}

function canOptionalThrowIn(state: GameState, player: PlayerId): boolean {
  if (state.defenderId === player) return false;
  if (state.table.length === 0) return false;
  return legalAttacks(state, player).length > 0;
}

/**
 * True when the player has a forced action the turn clock should resolve
 * (take / pass / transfer / open attack / defend). Optional throw-in is excluded.
 */
export function humanForcedAct(state: GameState, player: PlayerId): boolean {
  if (state.phase !== "playing") return false;

  const isDefender = state.defenderId === player;
  const attackable = legalAttacks(state, player);
  const mustOpen = !isDefender && state.table.length === 0 && attackable.length > 0;

  return (
    canTake(state, player) ||
    canPass(state, player) ||
    canTransfer(state, player) ||
    mustOpen ||
    hasLegalDefense(state, player)
  );
}

/** True when a human has any legal action, including optional throw-in. */
export function humanMustAct(state: GameState, player: PlayerId): boolean {
  if (state.phase !== "playing") return false;
  return humanForcedAct(state, player) || canOptionalThrowIn(state, player);
}

export type ActiveHumanOptions = {
  /** When true, ignore optional throw-in seats (used after a null timeout). */
  forcedOnly?: boolean;
};

/**
 * Human who should own the turn clock. Prefers forced actors so optional
 * throw-in never blocks a defender who can auto-TAKE on timeout.
 */
export function activeHumanPlayer(
  state: GameState,
  bots: Set<string>,
  options?: ActiveHumanOptions,
): PlayerId | null {
  const eligible = (p: PlayerId) =>
    !bots.has(p) && !state.finishedOrder.includes(p);

  for (const p of state.players) {
    if (!eligible(p)) continue;
    if (humanForcedAct(state, p)) return p;
  }

  if (options?.forcedOnly) return null;

  for (const p of state.players) {
    if (!eligible(p)) continue;
    if (canOptionalThrowIn(state, p)) return p;
  }

  return null;
}
