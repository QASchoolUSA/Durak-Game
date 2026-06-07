/** Screen-space rectangle for layout anchors (no RN dependency). */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function anchorCenter(rect: AnchorRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
