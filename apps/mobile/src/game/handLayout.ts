/** Layout math for the bottom hand fan — keeps every card inside the viewport. */

export interface HandLayout {
  spacing: number;
  /** Degrees of rotation applied per slot from center. */
  rotPerSlot: number;
}

/**
 * Compute fan spacing so the leftmost/rightmost cards (including rotation)
 * stay fully on screen.
 */
export function computeHandLayout(
  viewportWidth: number,
  cardW: number,
  cardH: number,
  count: number,
): HandLayout {
  if (count <= 1) return { spacing: 0, rotPerSlot: 0 };

  const hPad = 20;
  const mid = (count - 1) / 2;
  // Slightly less fan than before — smoother edges when rotated on screen.
  const rotPerSlot = count >= 6 ? 1.4 : count >= 4 ? 1.75 : 2.2;
  const maxRotRad = ((mid * rotPerSlot) * Math.PI) / 180;

  const halfW = cardW / 2;
  const halfH = cardH / 2;
  const bboxHalfW =
    halfW * Math.abs(Math.cos(maxRotRad)) + halfH * Math.abs(Math.sin(maxRotRad));

  const maxSpacing = Math.max(0, (viewportWidth / 2 - bboxHalfW - hPad) / mid);
  const desiredSpacing = cardW * 0.5;

  return {
    spacing: Math.min(maxSpacing, desiredSpacing),
    rotPerSlot,
  };
}
