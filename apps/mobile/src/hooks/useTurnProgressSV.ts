import { useEffect } from "react";
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  computeTurnRemaining,
  turnProgressFromRemaining,
  type TurnClockConfig,
} from "../game/turnClockEngine";

/**
 * Turn progress (0–1) as a Reanimated shared value that animates entirely on the
 * UI thread. A single `withTiming` drains the ring over the remaining time, so
 * the JS thread is never woken to update the visual countdown.
 *
 * (Previously this polled `setInterval(…, 100)` and `setState` ~10×/sec, which
 * re-rendered the SVG ring continuously for the whole match — a major source of
 * sustained CPU usage / device heating during online play.)
 *
 * Callers should pass `enabled: false` for any seat that isn't currently on the
 * clock so only the live seat animates.
 */
export function useTurnProgressSV(config: TurnClockConfig): SharedValue<number> {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!config.enabled || config.totalSeconds <= 0) {
      cancelAnimation(progress);
      progress.value = 1;
      return;
    }

    const remaining = computeTurnRemaining(config);
    const startProgress = turnProgressFromRemaining(remaining, config.totalSeconds);

    cancelAnimation(progress);
    progress.value = startProgress;

    if (remaining > 0) {
      progress.value = withTiming(0, {
        duration: remaining * 1000,
        easing: Easing.linear,
      });
    } else {
      progress.value = 0;
    }

    return () => cancelAnimation(progress);
  }, [
    progress,
    config.enabled,
    config.totalSeconds,
    config.lastMoveAt,
    config.turnDeadlineAt,
    config.playMode,
  ]);

  return progress;
}

/** @deprecated Use useTurnProgressSV — kept for import-path stability. */
export const useTurnProgress = useTurnProgressSV;
