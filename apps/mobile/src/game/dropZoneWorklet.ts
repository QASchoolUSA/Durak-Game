import type { DropZoneKind } from "./dropZones";

/** Serializable drop zone for UI-thread hit tests. */
export type WorkletDropZone = {
  kind: DropZoneKind;
  tableIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkletDragBounds = {
  centerX: number;
  centerY: number;
  halfW: number;
  halfH: number;
  aimX: number;
  aimY: number;
};

/** Encode hover target as a single number: tableIndex * 2 + (transfer ? 1 : 0), or -1. */
export function encodeHoverKey(kind: DropZoneKind | null, tableIndex: number): number {
  "worklet";
  if (kind == null || tableIndex < 0) return -1;
  return tableIndex * 2 + (kind === "transfer" ? 1 : 0);
}

export function decodeHoverKey(key: number): { kind: DropZoneKind; tableIndex: number } | null {
  "worklet";
  if (key < 0) return null;
  return {
    tableIndex: Math.floor(key / 2),
    kind: key % 2 === 1 ? "transfer" : "defend",
  };
}

function zoneCenter(z: WorkletDropZone): { x: number; y: number } {
  "worklet";
  return { x: z.x + z.width / 2, y: z.y + z.height / 2 };
}

function pointInRect(x: number, y: number, z: WorkletDropZone, pad: number): boolean {
  "worklet";
  return (
    x >= z.x - pad &&
    x <= z.x + z.width + pad &&
    y >= z.y - pad &&
    y <= z.y + z.height + pad
  );
}

/** Lightweight proximity hit-test for drag hover (beat/transfer slots). */
export function hitTestDropZones(
  bounds: WorkletDragBounds,
  zones: WorkletDropZone[],
): number {
  "worklet";
  if (zones.length === 0) return -1;

  let bestKey = -1;
  let bestDist = 180;

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i]!;
    const pad = 4;
    const aimX = bounds.aimX;
    const aimY = bounds.aimY;

    if (pointInRect(aimX, aimY, z, pad)) {
      return encodeHoverKey(z.kind, z.tableIndex);
    }

    const c = zoneCenter(z);
    const dx = aimX - c.x;
    const dy = aimY - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestKey = encodeHoverKey(z.kind, z.tableIndex);
    }
  }

  return bestKey;
}

export function toWorkletZones(zones: {
  kind: DropZoneKind;
  tableIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}[]): WorkletDropZone[] {
  return zones.map((z) => ({
    kind: z.kind,
    tableIndex: z.tableIndex,
    x: z.x,
    y: z.y,
    width: z.width,
    height: z.height,
  }));
}
