import type { Card, TablePair } from "@durak/game-core";
import type { AnchorRect } from "./anchorMath";
import { anchorCenter } from "./anchorMath";
import type { CardFlightStep } from "./cardFlight";
import {
  dealTimingForMode,
  getDealTiming,
  tableCardIdsFromPairs,
  type DealTimingMode,
} from "./dealSequence";

export const TABLE_CARD_ANCHOR_PREFIX = "table-card-";

export function tableCardAnchorId(cardId: string): string {
  return `${TABLE_CARD_ANCHOR_PREFIX}${cardId}`;
}

export function isTableCardAnchorId(anchorId: string): boolean {
  return anchorId.startsWith(TABLE_CARD_ANCHOR_PREFIX);
}

export interface TakeSnapshot {
  cardIds: string[];
  anchors: Record<string, AnchorRect>;
  cards?: Record<string, Card>;
}

export function buildTakeFlightQueue(
  snapshot: TakeSnapshot,
  handAnchor: AnchorRect,
  mode: DealTimingMode,
): CardFlightStep[] {
  const timing = getDealTiming(mode);
  const handCenter = anchorCenter(handAnchor);

  return snapshot.cardIds.map((cardId) => {
    const anchor = snapshot.anchors[tableCardAnchorId(cardId)];
    const from = anchor ? anchorCenter(anchor) : handCenter;
    return {
      id: cardId,
      fromX: from.x,
      fromY: from.y,
      toX: handCenter.x,
      toY: handCenter.y,
      flightMs: timing.flightMs,
      card: snapshot.cards?.[cardId],
    };
  });
}


export function takeTimingForMode(
  playMode: "solo" | "online",
  reduceMotion: boolean,
): DealTimingMode {
  return dealTimingForMode(playMode, reduceMotion);
}
