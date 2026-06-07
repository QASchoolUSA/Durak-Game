import React, { useMemo } from "react";
import type { PlayerId } from "@durak/game-core";
import { anchorCenter, type AnchorRect } from "./MeasuredAnchor";
import { cardSize } from "../theme";
import { dealSequenceDurationMs, type QueuedDealStep } from "../game/dealSequence";
import { CardFlightOverlay, type CardFlightStep } from "./CardFlightOverlay";

export interface FrozenDealOrigins {
  deck: AnchorRect;
  hand: AnchorRect;
  seats: Record<PlayerId, AnchorRect | undefined>;
}

export interface DealFlightOverlayProps {
  queue: QueuedDealStep[];
  humanId: PlayerId;
  origins: FrozenDealOrigins | null;
  onStepComplete: (step: QueuedDealStep) => void;
  onComplete: () => void;
  onDealSound?: () => void;
  playMode: "solo" | "online";
}

function DealFlightOverlayComponent({
  queue,
  humanId,
  origins,
  onStepComplete,
  onComplete,
  onDealSound,
  playMode,
}: DealFlightOverlayProps) {
  const { w: cardW, h: cardH } = cardSize.small;

  const flightQueue = useMemo((): CardFlightStep[] => {
    if (!origins || queue.length === 0) return [];

    const from = anchorCenter(origins.deck);

    const resolveTarget = (playerId: PlayerId): { x: number; y: number } => {
      if (playerId === humanId) return anchorCenter(origins.hand);
      const seat = origins.seats[playerId];
      if (!seat) return from;
      return anchorCenter(seat);
    };

    return queue.map((step) => {
      const to = resolveTarget(step.playerId);
      return {
        id: `${step.playerId}-${step.cardIndexInBatch}`,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        flightMs: step.flightMs,
      };
    });
  }, [origins, queue, humanId]);

  const handleStepComplete = (step: CardFlightStep) => {
    const index = flightQueue.findIndex((s) => s.id === step.id);
    const dealStep = queue[index];
    if (dealStep) onStepComplete(dealStep);
  };

  if (!origins || queue.length === 0) return null;

  return (
    <CardFlightOverlay
      queue={flightQueue}
      onStepComplete={handleStepComplete}
      onComplete={onComplete}
      onFlightSound={onDealSound}
      soundMode={playMode}
    />
  );
}

export const DealFlightOverlay = React.memo(DealFlightOverlayComponent);

export { dealSequenceDurationMs };
