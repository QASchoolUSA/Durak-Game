import {
  canPass,
  canTake,
  legalAttacks,
  pickMove,
  type GameState,
  type Move,
  type PlayerId,
} from "@durak/game-core";

export const DEFAULT_TURN_SECONDS = 12;
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

/** Human player who should act next, if any. */
export function activeHumanPlayer(
  state: GameState,
  bots: Set<string>,
): PlayerId | null {
  for (const p of state.players) {
    if (bots.has(p)) continue;
    if (state.finishedOrder.includes(p)) continue;
    if (pickMove(state, p, "medium")) return p;
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
