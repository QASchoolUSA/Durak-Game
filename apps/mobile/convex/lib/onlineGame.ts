import {
  canPass,
  canTake,
  canTransfer,
  legalAttacks,
  legalDefenses,
  pickMove,
  type GameState,
  type Move,
  type PlayerId,
  undefendedPairs,
} from "@durak/game-core";

export { DEFAULT_TURN_SECONDS } from "@durak/game-core";
export const LOBBY_STALE_MS = 30 * 60 * 1000;
export const PLAYING_STALE_MS = 2 * 60 * 60 * 1000;

/** Move when a human runs out of turn time (mirrors mobile autoMove.ts). */
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

export function botPlayerIds(
  members: { playerId?: string; isBot: boolean }[],
): Set<string> {
  const ids = new Set<string>();
  for (const m of members) {
    if (m.isBot && m.playerId) ids.add(m.playerId);
  }
  return ids;
}

/** True when a human has any legal action (mirrors mobile playerMustAct). */
export function humanMustAct(state: GameState, player: PlayerId): boolean {
  if (state.phase !== "playing") return false;

  const isDefender = state.defenderId === player;
  const attackable = legalAttacks(state, player);

  const defendable: Record<string, number[]> = {};
  if (isDefender && !state.takeInProgress) {
    for (const target of undefendedPairs(state)) {
      for (const card of legalDefenses(state, target)) {
        (defendable[card.id] ??= []).push(target);
      }
    }
  }

  const take = canTake(state, player);
  const pass = canPass(state, player);
  const transfer = canTransfer(state, player);
  const mustOpen = !isDefender && state.table.length === 0 && attackable.length > 0;

  return (
    take ||
    pass ||
    transfer ||
    mustOpen ||
    Object.keys(defendable).length > 0 ||
    (attackable.length > 0 && state.table.length > 0)
  );
}

/** Human player who should act next, if any. */
export function activeHumanPlayer(
  state: GameState,
  bots: Set<string>,
): PlayerId | null {
  for (const p of state.players) {
    if (bots.has(p)) continue;
    if (state.finishedOrder.includes(p)) continue;
    if (humanMustAct(state, p)) return p;
  }
  return null;
}

export function shouldDeferBot(state: GameState, bots: Set<string>): boolean {
  for (const p of state.players) {
    if (bots.has(p)) continue;
    if (pickMove(state, p, "medium")?.type === "TRANSFER") return true;
  }
  return false;
}
