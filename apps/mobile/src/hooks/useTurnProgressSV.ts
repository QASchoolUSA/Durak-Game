import { useEffect, useState } from "react";
import {
  computeTurnRemaining,
  turnProgressFromRemaining,
  type TurnClockConfig,
} from "../game/turnClockEngine";

function progressFromConfig(config: TurnClockConfig): number {
  if (!config.enabled || config.totalSeconds <= 0) return 0;
  const remaining = computeTurnRemaining(config);
  return turnProgressFromRemaining(remaining, config.totalSeconds);
}

/**
 * Turn progress (0-1) on the JS thread, polled every 100ms while enabled.
 * Side effects (haptics, timeout) are handled separately by useTurnTimeout —
 * callers should pass `enabled: false` for any seat that isn't the one
 * currently on the clock so only one instance polls at a time.
 */
export function useTurnProgress(config: TurnClockConfig): number {
  const [progress, setProgress] = useState(() => progressFromConfig(config));

  useEffect(() => {
    if (!config.enabled || config.totalSeconds <= 0) {
      setProgress(0);
      return;
    }

    const tick = () => setProgress(progressFromConfig(config));

    tick();
    const intervalId = setInterval(tick, 100);
    return () => clearInterval(intervalId);
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
