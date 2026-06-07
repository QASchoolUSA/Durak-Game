import { useEffect, useRef, useState } from "react";
import {
  tickTurnClock,
  type TurnClockConfig,
} from "../game/turnClockEngine";

export type { TurnClockConfig } from "../game/turnClockEngine";

/** Owns turn countdown state so parent screens avoid ~10Hz re-renders. */
export function useTurnClock(config: TurnClockConfig): number {
  const [remaining, setRemaining] = useState(config.totalSeconds);
  const firedRef = useRef(false);
  const prevRemainingRef = useRef(config.totalSeconds);
  const onTimeoutRef = useRef(config.onTimeout);
  onTimeoutRef.current = config.onTimeout;

  useEffect(() => {
    firedRef.current = false;
    prevRemainingRef.current = config.totalSeconds;

    if (!config.enabled || config.totalSeconds <= 0) {
      setRemaining(config.totalSeconds);
      return;
    }

    const ctx = {
      firedRef,
      prevRemainingRef,
      onTimeoutRef,
    };

    const tick = () => {
      setRemaining(tickTurnClock(config, ctx));
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
  ]);

  return remaining;
}
