import { useEffect, useRef } from "react";
import {
  tickTurnClock,
  type TurnClockConfig,
} from "../game/turnClockEngine";

const TICK_MS = 250;

/**
 * Runs turn-clock side effects (haptic warnings, timeout auto-play) without
 * touching React state, so it never triggers a re-render. Visual countdown
 * progress is handled separately by SeatTurnTimerRing/useTurnProgress, which
 * only ticks for the seat that currently owns the clock.
 */
export function useTurnTimeout(config: TurnClockConfig): void {
  const configRef = useRef(config);
  configRef.current = config;

  const firedRef = useRef(false);
  const prevRemainingRef = useRef(config.totalSeconds);
  const onTimeoutRef = useRef(config.onTimeout);
  onTimeoutRef.current = config.onTimeout;

  useEffect(() => {
    firedRef.current = false;
    prevRemainingRef.current = config.totalSeconds;

    if (!config.enabled || config.totalSeconds <= 0) return;

    const tick = () => {
      tickTurnClock(configRef.current, {
        firedRef,
        prevRemainingRef,
        onTimeoutRef,
      });
    };

    tick();
    const intervalId = setInterval(tick, TICK_MS);
    return () => clearInterval(intervalId);
  }, [
    config.enabled,
    config.totalSeconds,
    config.lastMoveAt,
    config.turnDeadlineAt,
    config.playMode,
  ]);
}
