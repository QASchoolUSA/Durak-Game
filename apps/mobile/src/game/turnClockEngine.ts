import type { MutableRefObject } from "react";
import type { GameState, PlayerId } from "@durak/game-core";
import { undefendedCount } from "@durak/game-core";
export type PlayMode = "solo" | "online";
import { trigger } from "../feedback/haptics";

export function activePlayerId(game: GameState): PlayerId {
  if (!game.takeInProgress && undefendedCount(game) > 0) return game.defenderId;
  return game.attackerId;
}

/** True when the human or any opponent seat should show a live turn clock. */
export function anySeatOnClock(
  game: GameState | null | undefined,
  humanId: PlayerId,
  humanMustAct: boolean,
  opponentIds: PlayerId[],
): boolean {
  if (!game || game.phase !== "playing") return false;
  if (humanMustAct && !game.finishedOrder.includes(humanId)) return true;

  const active = activePlayerId(game);
  return opponentIds.some(
    (id) => !game.finishedOrder.includes(id) && active === id,
  );
}

export interface TurnClockConfig {
  enabled: boolean;
  totalSeconds: number;
  lastMoveAt: number;
  turnDeadlineAt: number | null;
  playMode: PlayMode;
  onTimeout: () => void;
}

export interface TurnClockTickContext {
  firedRef: MutableRefObject<boolean>;
  prevRemainingRef: MutableRefObject<number>;
  onTimeoutRef: MutableRefObject<() => void>;
}

export function computeTurnRemaining(config: TurnClockConfig): number {
  if (!config.enabled || config.totalSeconds <= 0) {
    return config.totalSeconds;
  }
  if (config.playMode === "online" && config.turnDeadlineAt) {
    return Math.max(0, (config.turnDeadlineAt - Date.now()) / 1000);
  }
  const start = config.lastMoveAt || Date.now();
  return Math.max(0, config.totalSeconds - (Date.now() - start) / 1000);
}

/** Returns remaining seconds and runs haptic / timeout side effects. */
export function tickTurnClock(
  config: TurnClockConfig,
  ctx: TurnClockTickContext,
): number {
  const remaining = computeTurnRemaining(config);

  if (config.enabled && config.totalSeconds > 0) {
    const prevR = ctx.prevRemainingRef.current;
    if (prevR > 4 && remaining <= 4) trigger("timerWarning");
    if (prevR > 1 && remaining <= 1) trigger("timerCritical");
    ctx.prevRemainingRef.current = remaining;

    if (
      remaining <= 0 &&
      !ctx.firedRef.current &&
      config.playMode !== "online"
    ) {
      ctx.firedRef.current = true;
      trigger("timerExpired");
      ctx.onTimeoutRef.current();
    }
  } else {
    ctx.prevRemainingRef.current = remaining;
  }

  return remaining;
}

export function turnProgressFromRemaining(
  remaining: number,
  totalSeconds: number,
): number {
  if (totalSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, remaining / totalSeconds));
}
