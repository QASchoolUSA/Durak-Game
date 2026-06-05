/** Perimeter of a rounded rectangle (for SVG strokeDasharray). */
export function roundedRectPerimeter(w: number, h: number, r: number): number {
  "worklet";
  if (w <= 0 || h <= 0) return 0;
  const clampedR = Math.max(0, Math.min(r, w / 2, h / 2));
  const straight = 2 * (w - 2 * clampedR) + 2 * (h - 2 * clampedR);
  const arcs = 2 * Math.PI * clampedR;
  return straight + arcs;
}
