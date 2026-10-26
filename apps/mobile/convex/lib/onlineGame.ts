import {
  activeHumanPlayer as activeHumanPlayerCore,
  humanForcedAct,
  humanMustAct,
  pickMove,
  timeoutMoveFor,
  type ActiveHumanOptions,
  type GameState,
  type PlayerId,
} from "@durak/game-core";

export { DEFAULT_TURN_SECONDS } from "@durak/game-core";
export { humanForcedAct, humanMustAct, timeoutMoveFor };
export const LOBBY_STALE_MS = 30 * 60 * 1000;
export const PLAYING_STALE_MS = 2 * 60 * 60 * 1000;

/** Extra wait after turnDeadlineAt before counting an idle strike (in-flight RTT). */
export const NETWORK_GRACE_MS = 2_000;
/** Clock owner silent this long → "reconnecting" in room view (above 30s heartbeat). */
export const RECONNECT_SILENCE_MS = 45_000;
/** lastSeen still within this window counts as "in the match" for reconnect hold. */
export const RECONNECT_WINDOW_MS = 90_000;
/** Cap of recent clientMoveId entries retained for submitMove dedupe. */
export const MAX_RECENT_CLIENT_MOVE_IDS = 24;

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
  options?: ActiveHumanOptions,
): PlayerId | null {
  return activeHumanPlayerCore(state, bots, options);
}

export function shouldDeferBot(state: GameState, bots: Set<string>): boolean {
  for (const p of state.players) {
    if (bots.has(p)) continue;
    if (pickMove(state, p, "medium")?.type === "TRANSFER") return true;
  }
  return false;
}
