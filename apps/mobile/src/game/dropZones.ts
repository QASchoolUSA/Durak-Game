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
  /** Finger / touch in window space — used for slot targeting when set. */
  aimX?: number;
  aimY?: number;
}

/** Point used for beat/transfer slot hit tests (finger when available). */
export function aimPoint(bounds: DragCardBounds): { x: number; y: number } {
  return {
    x: bounds.aimX ?? bounds.centerX,
    y: bounds.aimY ?? bounds.centerY,
  };
}

/** Gap between beat and transfer slots in a pair (matches TableArea layout). */
export const TRANSFER_CHOICE_LAYOUT = {
  gap: 20,
} as const;

/** Symmetric pad for sticky release and near-miss only — not for primary choice. */
export const CHOICE_HIT_PAD = 4;

/** Prevent beat/transfer flicker when the center crosses the gap midpoint. */
const CHOICE_HYSTERESIS = 8;

const { w: TABLE_W, h: TABLE_H } = cardSize.table;

const LOCK_RELEASE_SLACK = 12;
const MIN_OVERLAP_RATIO = 0.08;
/** Start highlighting the nearest zone when the card centre is within this many px. */
const PROXIMITY_PX = 180;

export function pairLayoutWidth(showTransfer: boolean): number {
  if (!showTransfer) return TABLE_W + 16;
  return TABLE_W + TRANSFER_CHOICE_LAYOUT.gap + TABLE_W;
}

export function pointInRect(x: number, y: number, rect: ScreenRect): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

/** Expanded hit area around the measured visual slot (sticky release / near-miss). */
export function hitRect(zone: DropZone): ScreenRect {
  const pad = CHOICE_HIT_PAD;
  return {
    x: zone.x - pad,
    y: zone.y - pad,
    width: zone.width + pad * 2,
    height: zone.height + pad * 2,
  };
}

export function boundsForTableOverlap(bounds: DragCardBounds): DragCardBounds {
  return {
    centerX: bounds.centerX,
    centerY: bounds.centerY,
    halfW: TABLE_W / 2,
    halfH: TABLE_H / 2,
  };
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

function zoneCenter(zone: DropZone): { x: number; y: number } {
  return { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
}

function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pickClosestByAim(bounds: DragCardBounds, zones: DropZone[]): DropZone {
  const aim = aimPoint(bounds);
  let best = zones[0]!;
  let bestDist = Infinity;
  for (const zone of zones) {
    const c = zoneCenter(zone);
    const d = distanceSq(aim.x, aim.y, c.x, c.y);
    if (d < bestDist) {
      bestDist = d;
      best = zone;
    }
  }
  return best;
}

function gapMidpoint(defend: DropZone, transfer: DropZone): number {
  const beatRight = defend.x + defend.width;
  const xferLeft = transfer.x;
  return beatRight + (xferLeft - beatRight) / 2;
}

/** Midpoint of the physical gap between unpadded slot frames. */
function inVerticalBand(y: number, defend: DropZone, transfer: DropZone): boolean {
  const pad = 40;
  const top = Math.min(defend.y, transfer.y) - pad;
  const bottom = Math.max(defend.y + defend.height, transfer.y + transfer.height) + pad;
  return y >= top && y <= bottom;
}

/**
 * Definitive beat vs transfer pick using measured slot frames (no padded overlap).
 */
function resolveBeatTransferPair(
  bounds: DragCardBounds,
  defend: DropZone,
  transfer: DropZone,
  locked: DropZone | null,
): DropZone | null {
  const { x: aimX } = aimPoint(bounds);
  // Use card center Y — the card rises to the zone while the finger stays lower
  if (!inVerticalBand(bounds.centerY, defend, transfer)) return null;

  const beatLeft = defend.x;
  const beatRight = defend.x + defend.width;
  const xferLeft = transfer.x;
  const xferRight = transfer.x + transfer.width;
  const mid = gapMidpoint(defend, transfer);

  if (
    locked?.tableIndex === defend.tableIndex &&
    (locked.kind === "defend" || locked.kind === "transfer")
  ) {
    if (locked.kind === "defend" && aimX < mid + CHOICE_HYSTERESIS) {
      return defend;
    }
    if (locked.kind === "transfer" && aimX > mid - CHOICE_HYSTERESIS) {
      return transfer;
    }
  }

  if (aimX >= beatLeft && aimX <= beatRight) return defend;
  if (aimX >= xferLeft && aimX <= xferRight) return transfer;

  if (aimX > beatRight && aimX < xferLeft) {
    return aimX < mid ? defend : transfer;
  }

  const pad = CHOICE_HIT_PAD;
  const nearBeat =
    aimX >= beatLeft - pad &&
    aimX <= beatRight + pad &&
    aimY >= defend.y - pad &&
    aimY <= defend.y + defend.height + pad;
  const nearTransfer =
    aimX >= xferLeft - pad &&
    aimX <= xferRight + pad &&
    aimY >= transfer.y - pad &&
    aimY <= transfer.y + transfer.height + pad;

  if (nearBeat && !nearTransfer) return defend;
  if (nearTransfer && !nearBeat) return transfer;
  if (nearBeat && nearTransfer) return aimX < mid ? defend : transfer;

  return pickClosestByAim(bounds, [defend, transfer]);
}

function groupBeatTransferPairs(
  candidates: DropZone[],
): Array<{ tableIndex: number; defend: DropZone; transfer: DropZone }> {
  const byIndex = new Map<number, DropZone[]>();
  for (const zone of candidates) {
    const list = byIndex.get(zone.tableIndex) ?? [];
    list.push(zone);
    byIndex.set(zone.tableIndex, list);
  }

  const pairs: Array<{ tableIndex: number; defend: DropZone; transfer: DropZone }> = [];
  for (const [tableIndex, zones] of byIndex) {
    const defend = zones.find((z) => z.kind === "defend");
    const transfer = zones.find((z) => z.kind === "transfer");
    if (defend && transfer) pairs.push({ tableIndex, defend, transfer });
  }
  return pairs;
}

function resolvePerevodnoyChoice(
  bounds: DragCardBounds,
  candidates: DropZone[],
  locked: DropZone | null,
): DropZone | null {
  const pairs = groupBeatTransferPairs(candidates);
  if (pairs.length === 0) return null;

  let best: DropZone | null = null;
  let bestDist = Infinity;

  for (const { defend, transfer } of pairs) {
    const pick = resolveBeatTransferPair(bounds, defend, transfer, locked);
    if (!pick) continue;

    const aim = aimPoint(bounds);
    const c = zoneCenter(pick);
    const d = distanceSq(aim.x, aim.y, c.x, c.y);
    if (d < bestDist) {
      bestDist = d;
      best = pick;
    }
  }

  return best;
}

/** Keep lock while center stays near the locked slot (with pair hysteresis). */
export function releaseLockedZone(
  bounds: DragCardBounds,
  locked: DropZone,
  partner: DropZone | null = null,
): boolean {
  if (partner && partner.tableIndex === locked.tableIndex) {
    const defend = locked.kind === "defend" ? locked : partner;
    const transfer = locked.kind === "transfer" ? locked : partner;
    const mid = gapMidpoint(defend, transfer);
    const { x: aimX } = aimPoint(bounds);

    if (!inVerticalBand(bounds.centerY, defend, transfer)) return false;

    if (locked.kind === "defend" && aimX < mid + CHOICE_HYSTERESIS) return true;
    if (locked.kind === "transfer" && aimX > mid - CHOICE_HYSTERESIS) return true;
    return false;
  }

  const hit = hitRect(locked);
  const slack = LOCK_RELEASE_SLACK;
  return pointInRect(bounds.centerX, bounds.centerY, {
    x: hit.x - slack,
    y: hit.y - slack,
    width: hit.width + slack * 2,
    height: hit.height + slack * 2,
  });
}

function centerHits(bounds: DragCardBounds, candidates: DropZone[]): DropZone[] {
  const aim = aimPoint(bounds);
  return candidates.filter((zone) => pointInRect(aim.x, aim.y, hitRect(zone)));
}

function resolveByOverlap(
  bounds: DragCardBounds,
  candidates: DropZone[],
): DropZone | null {
  const cardRect = boundsToRect(bounds);
  const cardArea = cardRect.width * cardRect.height;
  if (cardArea <= 0) return null;

  let best: DropZone | null = null;
  let bestScore = MIN_OVERLAP_RATIO;

  for (const zone of candidates) {
    const overlap = overlapArea(cardRect, hitRect(zone));
    if (overlap <= 0) continue;
    const score = overlap / cardArea;
    if (score > bestScore) {
      bestScore = score;
      best = zone;
    }
  }

  return best;
}

export interface ResolveDropOptions {
  kinds?: DropZoneKind[];
  tableIndices?: number[];
  /** Perevodnoy beat/transfer — use slot-frame resolver, not padded overlap. */
  tableOverlap?: boolean;
  /** Final drop: ignore sticky lock and pick from current position only. */
  commit?: boolean;
}

export interface ResolveDropResult {
  zone: DropZone | null;
  locked: DropZone | null;
}

function lockZone(zone: DropZone): DropZone {
  return zone;
}

/**
 * Resolve which zone the dragged card targets.
 */
export function resolveDropFromBounds(
  bounds: DragCardBounds,
  zones: DropZone[],
  options: ResolveDropOptions = {},
  locked: DropZone | null = null,
): ResolveDropResult {
  const { kinds, tableIndices, tableOverlap, commit } = options;

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

  const activeLock = commit ? null : locked;

  if (activeLock && candidates.some(
    (z) => z.kind === activeLock.kind && z.tableIndex === activeLock.tableIndex,
  )) {
    const partner = candidates.find(
      (z) =>
        z.tableIndex === activeLock.tableIndex && z.kind !== activeLock.kind,
    ) ?? null;
    if (releaseLockedZone(bounds, activeLock, partner)) {
      return { zone: activeLock, locked: activeLock };
    }
  }

  if (tableOverlap) {
    const choice = resolvePerevodnoyChoice(bounds, candidates, activeLock);
    if (choice) {
      return { zone: choice, locked: commit ? null : lockZone(choice) };
    }
  }

  const hits = centerHits(bounds, candidates);
  if (hits.length === 1) {
    const zone = hits[0]!;
    return { zone, locked: commit ? null : lockZone(zone) };
  }
  if (hits.length > 1) {
    const zone = pickClosestByAim(bounds, hits);
    return { zone, locked: commit ? null : lockZone(zone) };
  }

  const overlapBounds = tableOverlap ? boundsForTableOverlap(bounds) : bounds;
  const best = resolveByOverlap(overlapBounds, candidates);
  if (best) {
    return { zone: best, locked: commit ? null : lockZone(best) };
  }

  // Proximity — highlight the nearest reachable zone as the card approaches.
  // No lock so the highlight switches freely while the card is still far away.
  if (!commit) {
    let nearestZone: DropZone | null = null;
    let nearestDist = PROXIMITY_PX;
    for (const zone of candidates) {
      const c = zoneCenter(zone);
      const dx = bounds.centerX - c.x;
      const dy = bounds.centerY - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestZone = zone;
      }
    }
    if (nearestZone) {
      return { zone: nearestZone, locked: null };
    }
  }

  return { zone: null, locked: null };
}
