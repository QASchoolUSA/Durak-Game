import { useEffect, useRef } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import {
  tickTurnClock,
  turnProgressFromRemaining,
  type TurnClockConfig,
} from "../game/turnClockEngine";

/** UI-thread turn progress (1 = full time, 0 = expired) without parent re-renders. */
export function useTurnProgressSV(config: TurnClockConfig): SharedValue<number> {
  const progressSV = useSharedValue(0);
  const firedRef = useRef(false);
  const prevRemainingRef = useRef(config.totalSeconds);
  const onTimeoutRef = useRef(config.onTimeout);
  onTimeoutRef.current = config.onTimeout;

  useEffect(() => {
    firedRef.current = false;
    prevRemainingRef.current = config.totalSeconds;

    if (!config.enabled || config.totalSeconds <= 0) {
      progressSV.value = 0;
      return;
    }

    const ctx = {
      firedRef,
      prevRemainingRef,
      onTimeoutRef,
    };

    const tick = () => {
      const remaining = tickTurnClock(config, ctx);
      progressSV.value = turnProgressFromRemaining(
        remaining,
        config.totalSeconds,
      );
    };

    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [
    config.enabled,
    config.totalSeconds,
    config.lastMoveAt,
    config.turnDeadlineAt,
    config.playMode,
    progressSV,
  ]);

  return progressSV;
}
