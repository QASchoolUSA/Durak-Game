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

export function pointInRect(x: number, y: number, rect: ScreenRect): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

export function findDropZone(x: number, y: number, zones: DropZone[]): DropZone | null {
  // Prefer transfer over defend when zones overlap (transfer sits beside the card).
  const ordered = [...zones].sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "transfer" ? -1 : 1;
  });
  for (const zone of ordered) {
    if (pointInRect(x, y, zone)) return zone;
  }
  return null;
}
