import { cardSize } from "../theme";

export type DropZoneKind = "defend" | "transfer";

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DropZone extends ScreenRect {
  kind: DropZoneKind;
  tableIndex: number;
}

/** Dragged hand card bounds in window coordinates. */
export interface DragCardBounds {
  centerX: number;
  centerY: number;
  halfW: number;
  halfH: number;
}

/** Layout constants shared between TableArea visuals and hit registration. */
export const TRANSFER_CHOICE_LAYOUT = {
  gap: 20,
  /** Invisible touch target — wider than the card silhouette. */
  transferHitExtraW: 52,
  transferHitExtraH: 28,
  /** Generous padding around the attack card for beat drops. */
  beatHitPad: { top: 28, bottom: 28, left: 28, right: 6 },
  transferHitPad: { top: 28, bottom: 28, left: 6, right: 28 },
} as const;

const { w: TABLE_W, h: TABLE_H } = cardSize.table;

export function transferHitWidth(): number {
  return TABLE_W + TRANSFER_CHOICE_LAYOUT.transferHitExtraW;
}

export function transferHitHeight(): number {
  return TABLE_H + TRANSFER_CHOICE_LAYOUT.transferHitExtraH;
}

export function pairLayoutWidth(showTransfer: boolean): number {
  if (!showTransfer) return TABLE_W + 16;
  return TABLE_W + TRANSFER_CHOICE_LAYOUT.gap + transferHitWidth();
}

/** Register beat + transfer zones from one pair anchor measured in window space. */
export function zonesFromPairAnchor(
  tableIndex: number,
  anchorX: number,
  anchorY: number,
  showTransfer: boolean,
): DropZone[] {
  const zones: DropZone[] = [
    {
      kind: "defend",
      tableIndex,
      x: anchorX,
      y: anchorY,
      width: TABLE_W,
      height: TABLE_H,
    },
  ];
  if (showTransfer) {
    zones.push({
      kind: "transfer",
      tableIndex,
      x: anchorX + TABLE_W + TRANSFER_CHOICE_LAYOUT.gap,
      y: anchorY,
      width: transferHitWidth(),
      height: transferHitHeight(),
    });
  }
  return zones;
}

export function pointInRect(x: number, y: number, rect: ScreenRect): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

function boundsToRect(bounds: DragCardBounds): ScreenRect {
  return {
    x: bounds.centerX - bounds.halfW,
    y: bounds.centerY - bounds.halfH,
    width: bounds.halfW * 2,
    height: bounds.halfH * 2,
  };
}

function overlapArea(a: ScreenRect, b: ScreenRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

/** Expanded, non-overlapping hit area for a zone. */
export function hitRect(zone: DropZone): ScreenRect {
  const pad =
    zone.kind === "defend"
      ? TRANSFER_CHOICE_LAYOUT.beatHitPad
      : TRANSFER_CHOICE_LAYOUT.transferHitPad;

  return {
    x: zone.x - pad.left,
    y: zone.y - pad.top,
    width: zone.width + pad.left + pad.right,
    height: zone.height + pad.top + pad.bottom,
  };
}

/** Keep the locked zone until the card clearly leaves it (prevents edge flicker). */
export function releaseLockedZone(bounds: DragCardBounds, locked: DropZone): boolean {
  const hit = hitRect(locked);
  const release = 36;
  return (
    bounds.centerX >= hit.x - release &&
    bounds.centerX <= hit.x + hit.width + release &&
    bounds.centerY >= hit.y - release &&
    bounds.centerY <= hit.y + hit.height + release
  );
}

export interface ResolveDropOptions {
  kinds?: DropZoneKind[];
  tableIndices?: number[];
}

export interface ResolveDropResult {
  zone: DropZone | null;
  locked: DropZone | null;
}

const MIN_OVERLAP_RATIO = 0.12;

/**
 * Resolve which zone the dragged card targets.
 * Uses card/card overlap (not a single point) plus sticky intent lock.
 */
export function resolveDropFromBounds(
  bounds: DragCardBounds,
  zones: DropZone[],
  options: ResolveDropOptions = {},
  locked: DropZone | null = null,
): ResolveDropResult {
  const { kinds, tableIndices } = options;

  let candidates = zones;
  if (kinds?.length) {
    candidates = candidates.filter((z) => kinds.includes(z.kind));
  }
  if (tableIndices?.length) {
    candidates = candidates.filter((z) => tableIndices.includes(z.tableIndex));
  }

  if (candidates.length === 0) {
    return { zone: null, locked: null };
  }

  if (locked && candidates.some((z) => z.kind === locked.kind && z.tableIndex === locked.tableIndex)) {
    if (releaseLockedZone(bounds, locked)) {
      return { zone: locked, locked };
    }
  }

  const cardRect = boundsToRect(bounds);
  const cardArea = cardRect.width * cardRect.height;

  let best: DropZone | null = null;
  let bestScore = MIN_OVERLAP_RATIO;

  for (const zone of candidates) {
    const hit = hitRect(zone);
    const overlap = overlapArea(cardRect, hit);
    if (overlap <= 0) continue;

    const score = overlap / cardArea;
    const centerInside = pointInRect(bounds.centerX, bounds.centerY, hit);
    const adjusted = centerInside ? score + 0.25 : score;

    if (adjusted > bestScore) {
      bestScore = adjusted;
      best = zone;
    }
  }

  if (best) {
    return { zone: best, locked: best };
  }

  return { zone: null, locked: null };
}
