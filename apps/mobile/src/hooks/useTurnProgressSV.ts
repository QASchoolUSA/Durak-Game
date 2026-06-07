import { useEffect, useRef, useState } from "react";
import {
  computeTurnRemaining,
  tickTurnClock,
  turnProgressFromRemaining,
  type TurnClockConfig,
} from "../game/turnClockEngine";

function progressFromConfig(config: TurnClockConfig): number {
  if (!config.enabled || config.totalSeconds <= 0) return 0;
  const remaining = computeTurnRemaining(config);
  return turnProgressFromRemaining(remaining, config.totalSeconds);
}

/**
 * Turn progress on the JS thread (no useFrameCallback / SVG worklets).
 * Stable in Expo Go; timer ring reads the returned 0–1 value each tick.
 */
export function useTurnProgress(config: TurnClockConfig): number {
  const [progress, setProgress] = useState(() => progressFromConfig(config));
  const configRef = useRef(config);
  configRef.current = config;

  const firedRef = useRef(false);
  const prevRemainingRef = useRef(config.totalSeconds);
  const onTimeoutRef = useRef(config.onTimeout);
  onTimeoutRef.current = config.onTimeout;

  useEffect(() => {
    firedRef.current = false;
    prevRemainingRef.current = config.totalSeconds;

    if (!config.enabled || config.totalSeconds <= 0) {
      setProgress(0);
      return;
    }

    const tick = () => {
      const c = configRef.current;
      const remaining = computeTurnRemaining(c);
      setProgress(turnProgressFromRemaining(remaining, c.totalSeconds));
      tickTurnClock(c, {
        firedRef,
        prevRemainingRef,
        onTimeoutRef,
      });
    };

    setProgress(progressFromConfig(config));
    tick();
    const intervalId = setInterval(tick, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    config.enabled,
    config.totalSeconds,
    config.lastMoveAt,
    config.turnDeadlineAt,
    config.playMode,
  ]);

  return progress;
}

/** @deprecated Use useTurnProgress — kept for import path stability. */
export const useTurnProgressSV = useTurnProgress;
