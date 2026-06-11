import React from "react";
import { useTurnProgress } from "../hooks/useTurnProgressSV";
import type { TurnClockConfig } from "../game/turnClockEngine";
import { TurnTimerRing, type TurnTimerRingProps } from "./TurnTimerRing";

export type SeatTurnTimerRingProps = Omit<TurnTimerRingProps, "progress"> & {
  /** Shared turn-clock config (stable across the match, updates per turn). */
  clockConfig: TurnClockConfig;
};

/**
 * Polls turn progress for a single seat's ring. Only the seat whose ring is
 * actually live (`clockActive`) sets up the 100ms poll — every other seat
 * renders a static ring without subscribing to the clock at all.
 */
function SeatTurnTimerRingComponent({
  clockConfig,
  clockActive,
  ...ringProps
}: SeatTurnTimerRingProps) {
  const progress = useTurnProgress({
    ...clockConfig,
    enabled: clockConfig.enabled && clockActive,
  });

  return <TurnTimerRing progress={progress} clockActive={clockActive} {...ringProps} />;
}

export const SeatTurnTimerRing = React.memo(SeatTurnTimerRingComponent);
