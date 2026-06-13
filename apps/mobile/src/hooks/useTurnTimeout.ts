import { useEffect, useRef } from "react";
import { useAppActive } from "./useAppActive";
import { trigger } from "../feedback/haptics";
import {
  computeTurnRemaining,
  type TurnClockConfig,
} from "../game/turnClockEngine";

/**
 * Runs turn-clock side effects (haptic warnings, timeout auto-play) using precise
 * scheduled timeouts. This completely eliminates periodic JS polling (previously
 * setInterval every 500ms), keeping the JS thread 100% idle between transitions.
 */
export function useTurnTimeout(config: TurnClockConfig): void {
  const configRef = useRef(config);
  configRef.current = config;

  const appActive = useAppActive();

  useEffect(() => {
    if (!config.enabled || config.totalSeconds <= 0 || !appActive) return;

    const remaining = computeTurnRemaining(config);
    const remainingMs = remaining * 1000;
    if (remainingMs <= 0) return;

    let warningTimeoutId: ReturnType<typeof setTimeout> | undefined;
    const warningDelay = remainingMs - 4000;
    if (warningDelay > 0) {
      warningTimeoutId = setTimeout(() => {
        trigger("timerWarning");
      }, warningDelay);
    }

    let criticalTimeoutId: ReturnType<typeof setTimeout> | undefined;
    const criticalDelay = remainingMs - 1000;
    if (criticalDelay > 0) {
      criticalTimeoutId = setTimeout(() => {
        trigger("timerCritical");
      }, criticalDelay);
    }

    const expiredTimeoutId = setTimeout(() => {
      if (configRef.current.playMode !== "online") {
        trigger("timerExpired");
        configRef.current.onTimeout();
      }
    }, remainingMs);

    return () => {
      if (warningTimeoutId) clearTimeout(warningTimeoutId);
      if (criticalTimeoutId) clearTimeout(criticalTimeoutId);
      clearTimeout(expiredTimeoutId);
    };
  }, [
    config.enabled,
    config.totalSeconds,
    config.lastMoveAt,
    config.turnDeadlineAt,
    config.playMode,
    appActive,
  ]);
}
