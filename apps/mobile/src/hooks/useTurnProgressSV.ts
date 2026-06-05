import { useEffect, useRef } from "react";
import {
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  tickTurnClock,
  turnProgressFromRemaining,
  type TurnClockConfig,
} from "../game/turnClockEngine";

/** UI-thread turn progress (1 = full time, 0 = expired) without parent re-renders. */
export function useTurnProgressSV(config: TurnClockConfig): SharedValue<number> {
  const progressSV = useSharedValue(0);
  const enabledSV = useSharedValue(config.enabled ? 1 : 0);
  const totalSV = useSharedValue(config.totalSeconds);
  const deadlineSV = useSharedValue(config.turnDeadlineAt ?? 0);
  const lastMoveSV = useSharedValue(config.lastMoveAt);
  const onlineSV = useSharedValue(config.playMode === "online" ? 1 : 0);

  const firedRef = useRef(false);
  const prevRemainingRef = useRef(config.totalSeconds);
  const onTimeoutRef = useRef(config.onTimeout);
  onTimeoutRef.current = config.onTimeout;

  useEffect(() => {
    enabledSV.value = config.enabled ? 1 : 0;
    totalSV.value = config.totalSeconds;
    deadlineSV.value = config.turnDeadlineAt ?? 0;
    lastMoveSV.value = config.lastMoveAt;
    onlineSV.value = config.playMode === "online" ? 1 : 0;
  }, [
    config.enabled,
    config.totalSeconds,
    config.turnDeadlineAt,
    config.lastMoveAt,
    config.playMode,
    enabledSV,
    totalSV,
    deadlineSV,
    lastMoveSV,
    onlineSV,
  ]);

  useFrameCallback(() => {
    "worklet";
    if (enabledSV.value <= 0 || totalSV.value <= 0) {
      progressSV.value = 0;
      return;
    }
    let remaining = 0;
    if (onlineSV.value > 0 && deadlineSV.value > 0) {
      remaining = Math.max(0, (deadlineSV.value - Date.now()) / 1000);
    } else {
      remaining = Math.max(
        0,
        totalSV.value - (Date.now() - lastMoveSV.value) / 1000,
      );
    }
    progressSV.value = turnProgressFromRemaining(remaining, totalSV.value);
  });

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
      tickTurnClock(config, ctx);
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
