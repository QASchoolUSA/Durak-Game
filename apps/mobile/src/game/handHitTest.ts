/** Rotated hit-testing for the bottom hand fan — worklet-safe. */

export const TOUCH_PAD_BOTTOM = 8;
const HIT_PAD = 6;

export interface HandHitLayout {
  width: number;
  total: number;
  spacing: number;
  rotPerSlot: number;
  cardW: number;
  cardH: number;
  handH: number;
}

function slotRestPose(slot: number, layout: HandHitLayout) {
  "worklet";
  const mid = (layout.total - 1) / 2;
  const rel = slot - mid;
  const centerX = layout.width / 2 + rel * layout.spacing;
  const bottom = layout.handH - TOUCH_PAD_BOTTOM;
  const rotDeg = rel * layout.rotPerSlot;
  return { centerX, bottom, rotDeg };
}

function pointInRotatedCard(
  x: number,
  y: number,
  slot: number,
  layout: HandHitLayout,
): boolean {
  "worklet";
  const { centerX, bottom, rotDeg } = slotRestPose(slot, layout);
  const { cardW, cardH } = layout;
  const dx = x - centerX;
  const dy = y - bottom;
  const rad = (-rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const halfW = cardW / 2 + HIT_PAD;
  return lx >= -halfW && lx <= halfW && ly >= -cardH - HIT_PAD && ly <= HIT_PAD;
}

/** Rest center of a card in hand-layer coordinates. */
export function cardRestCenter(
  slot: number,
  layout: HandHitLayout,
): { centerX: number; centerY: number } {
  "worklet";
  const mid = (layout.total - 1) / 2;
  const centerX = layout.width / 2 + (slot - mid) * layout.spacing;
  const centerY = layout.handH - TOUCH_PAD_BOTTOM - layout.cardH / 2;
  return { centerX, centerY };
}

/**
 * Pick the topmost card under (x, y). Returns -1 when nothing matches.
 * Iterates high slot index first so picks match HandCard zIndex (slotIndex).
 * When playableMask is set, only those slots are considered.
 */
export function pickCardAt(
  x: number,
  y: number,
  layout: HandHitLayout,
  playableMask?: boolean[],
): number {
  "worklet";
  const { total } = layout;

  for (let i = total - 1; i >= 0; i--) {
    if (playableMask && !playableMask[i]) continue;
    if (pointInRotatedCard(x, y, i, layout)) return i;
  }

  return -1;
}
