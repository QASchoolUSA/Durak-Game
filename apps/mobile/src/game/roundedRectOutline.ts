import { roundedRectPerimeter } from "./roundedRectPerimeter";

/** Matches React Native borderRadius clamp on a W x H view. */
export function effectiveChipRadius(
  width: number,
  height: number,
  maxRadius: number,
): number {
  if (width <= 0 || height <= 0) return 0;
  return Math.max(0, Math.min(maxRadius, width / 2, height / 2));
}

export interface RoundedRectOutline {
  d: string;
  perimeter: number;
  radius: number;
}

/**
 * SVG path for a timer stroke hugging a rounded chip.
 * Starts at top center and traces clockwise along the stroke centerline.
 */
export function roundedRectOutlinePath(
  width: number,
  height: number,
  maxRadius: number,
  strokeWidth: number,
): RoundedRectOutline | null {
  if (width <= 0 || height <= 0 || strokeWidth <= 0) return null;

  const inset = strokeWidth / 2;
  const w = width - strokeWidth;
  const h = height - strokeWidth;
  if (w <= 0 || h <= 0) return null;

  const r = effectiveChipRadius(w, h, maxRadius);
  const left = inset;
  const right = width - inset;
  const top = inset;
  const bottom = height - inset;
  const cx = width / 2;

  const d = [
    `M ${cx} ${top}`,
    `L ${right - r} ${top}`,
    `A ${r} ${r} 0 0 1 ${right} ${top + r}`,
    `L ${right} ${bottom - r}`,
    `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `L ${left + r} ${bottom}`,
    `A ${r} ${r} 0 0 1 ${left} ${bottom - r}`,
    `L ${left} ${top + r}`,
    `A ${r} ${r} 0 0 1 ${left + r} ${top}`,
    `L ${cx} ${top}`,
    "Z",
  ].join(" ");

  return {
    d,
    perimeter: roundedRectPerimeter(w, h, r),
    radius: r,
  };
}
