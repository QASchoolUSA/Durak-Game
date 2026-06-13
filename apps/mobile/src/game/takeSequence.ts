import type { Card, TablePair } from "@durak/game-core";
import type { AnchorRect } from "./anchorMath";
import { anchorCenter } from "./anchorMath";
import type { CardFlightStep } from "./cardFlight";
import { computeHandLayout } from "./handLayout";
import { TOUCH_PAD_BOTTOM } from "./handHitTest";
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

/** Geometry needed to fly taken cards to their final sorted hand slots. */
export interface TakeHandLayout {
  /** Card ids in their final sorted display order in the hand. */
  sortedHandIds: string[];
  cardW: number;
  cardH: number;
  hPad: number;
}

/**
 * Screen-space CENTER of a hand slot, mirroring HandCard's layout math
 * (cards are centered at `restX`, resting near the bottom of the hand band).
 */
export function handSlotCenter(
  handAnchor: AnchorRect,
  layout: TakeHandLayout,
  slotIndex: number,
): { x: number; y: number } {
  const total = layout.sortedHandIds.length;
  const { spacing } = computeHandLayout(
    handAnchor.width,
    layout.cardW,
    layout.cardH,
    total,
    layout.hPad,
  );
  const mid = (total - 1) / 2;
  const restX = handAnchor.width / 2 + (slotIndex - mid) * spacing;
  return {
    x: handAnchor.x + restX,
    y: handAnchor.y + layout.cardH / 2 + TOUCH_PAD_BOTTOM,
  };
}

/**
 * Flight steps for taking cards off the table. Each card flies from its table
 * position straight to its FINAL sorted slot in the hand (not a shared center),
 * so it can hand off seamlessly to the revealed hand card with no reposition.
 */
export function buildTakeFlightQueue(
  snapshot: TakeSnapshot,
  handAnchor: AnchorRect,
  mode: DealTimingMode,
  layout?: TakeHandLayout,
): CardFlightStep[] {
  const timing = getDealTiming(mode);
  const handCenter = anchorCenter(handAnchor);

  return snapshot.cardIds.map((cardId) => {
    const anchor = snapshot.anchors[tableCardAnchorId(cardId)];
    const from = anchor ? anchorCenter(anchor) : handCenter;
    const slotIndex = layout ? layout.sortedHandIds.indexOf(cardId) : -1;
    const to =
      layout && slotIndex >= 0
        ? handSlotCenter(handAnchor, layout, slotIndex)
        : handCenter;
    return {
      id: cardId,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
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
