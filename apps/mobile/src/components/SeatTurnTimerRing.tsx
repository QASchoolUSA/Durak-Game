import React from "react";
import { useTurnProgressSV } from "../hooks/useTurnProgressSV";
import type { TurnClockConfig } from "../game/turnClockEngine";
import { TurnTimerRing, type TurnTimerRingProps } from "./TurnTimerRing";

export type SeatTurnTimerRingProps = Omit<TurnTimerRingProps, "progress"> & {
  /** Shared turn-clock config (stable across the match, updates per turn). */
  clockConfig: TurnClockConfig;
};

/**
 * Drives a single seat's turn-clock ring via a UI-thread shared value. Only the
 * seat whose ring is actually live (`clockActive`) animates; every other seat
 * renders a static, full ring without any per-tick work.
 */
function SeatTurnTimerRingComponent({
  clockConfig,
  clockActive,
  ...ringProps
}: SeatTurnTimerRingProps) {
  const progress = useTurnProgressSV({
    ...clockConfig,
    enabled: clockConfig.enabled && clockActive,
  });

  return <TurnTimerRing progress={progress} clockActive={clockActive} {...ringProps} />;
}

export const SeatTurnTimerRing = React.memo(SeatTurnTimerRingComponent);
