import type { TablePair } from "@durak/game-core";
import type { AnchorRect } from "./anchorMath";
import { anchorCenter } from "./anchorMath";
import type { CardFlightStep } from "./cardFlight";
import { dealTimingForMode, getDealTiming, type DealTimingMode } from "./dealSequence";

export const TABLE_CARD_ANCHOR_PREFIX = "table-card-";

export function tableCardAnchorId(cardId: string): string {
  return `${TABLE_CARD_ANCHOR_PREFIX}${cardId}`;
}

export function isTableCardAnchorId(anchorId: string): boolean {
  return anchorId.startsWith(TABLE_CARD_ANCHOR_PREFIX);
}

export function tableCardIdsFromPairs(table: TablePair[]): string[] {
  const ids: string[] = [];
  for (const pair of table) {
    ids.push(pair.attack.id);
    if (pair.defense) ids.push(pair.defense.id);
  }
  return ids;
}

export interface TakeSnapshot {
  cardIds: string[];
  anchors: Record<string, AnchorRect>;
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
    };
  });
}

export function takeTimingForMode(
  playMode: "solo" | "online",
  reduceMotion: boolean,
): DealTimingMode {
  return dealTimingForMode(playMode, reduceMotion);
}
