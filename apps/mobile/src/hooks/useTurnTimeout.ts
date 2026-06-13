import { useEffect, useRef } from "react";
import {
  tickTurnClock,
  type TurnClockConfig,
} from "../game/turnClockEngine";

// Side-effects only (no re-render). 500ms keeps the JS thread mostly idle while
// still catching the 4s / 1s warning thresholds and firing timeout auto-play
// within tolerance. The visual ring is animated separately on the UI thread.
const TICK_MS = 500;

/**
 * Runs turn-clock side effects (haptic warnings, timeout auto-play) without
 * touching React state, so it never triggers a re-render. Visual countdown
 * progress is handled separately by SeatTurnTimerRing/useTurnProgressSV, which
 * animates on the UI thread for the seat that currently owns the clock.
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
