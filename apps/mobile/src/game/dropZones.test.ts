import { describe, expect, it } from "vitest";
import {
  type DragCardBounds,
  type DropZone,
  boundsForTableOverlap,
  hitRect,
  pointInRect,
  releaseLockedZone,
  resolveDropFromBounds,
} from "./dropZones";

function zone(
  kind: DropZone["kind"],
  tableIndex: number,
  x: number,
  y: number,
  width = 62,
  height = 87,
): DropZone {
  return { kind, tableIndex, x, y, width, height };
}

function bounds(cx: number, cy: number, halfW = 42, halfH = 59): DragCardBounds {
  return { centerX: cx, centerY: cy, halfW, halfH };
}

/** Beat 100–162, gap 162–182, transfer 182–244. */
const PAIR_ZONES = [
  zone("defend", 0, 100, 200),
  zone("transfer", 0, 182, 200),
];

const GAP_MID = 172;

describe("resolveDropFromBounds", () => {
  it("picks defend when center is over beat slot", () => {
    const { zone: z } = resolveDropFromBounds(
      bounds(131, 243),
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
    );
    expect(z?.kind).toBe("defend");
  });

  it("picks transfer when center is over transfer slot", () => {
    const { zone: z } = resolveDropFromBounds(
      bounds(213, 243),
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
    );
    expect(z?.kind).toBe("transfer");
  });

  it("gap tie-break: left of midpoint → defend", () => {
    const { zone: z } = resolveDropFromBounds(
      bounds(GAP_MID - 2, 243),
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
    );
    expect(z?.kind).toBe("defend");
  });

  it("gap tie-break: right of midpoint → transfer", () => {
    const { zone: z } = resolveDropFromBounds(
      bounds(GAP_MID + 2, 243),
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
    );
    expect(z?.kind).toBe("transfer");
  });

  it("large hand overlap spanning both but center on beat → defend", () => {
    const { zone: z } = resolveDropFromBounds(
      bounds(131, 243, 42, 59),
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
    );
    expect(z?.kind).toBe("defend");
  });

  it("large hand overlap spanning both but center on transfer → transfer", () => {
    const { zone: z } = resolveDropFromBounds(
      bounds(213, 243, 42, 59),
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
    );
    expect(z?.kind).toBe("transfer");
  });

  it("finger over beat wins when card center is in gap", () => {
    const GAP_MID = 172;
    const { zone: z } = resolveDropFromBounds(
      {
        centerX: GAP_MID,
        centerY: 243,
        halfW: 42,
        halfH: 59,
        aimX: 131,
        aimY: 243,
      },
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
    );
    expect(z?.kind).toBe("defend");
  });

  it("finger over transfer wins when card center is over beat", () => {
    const { zone: z } = resolveDropFromBounds(
      {
        centerX: 131,
        centerY: 243,
        halfW: 42,
        halfH: 59,
        aimX: 213,
        aimY: 243,
      },
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
    );
    expect(z?.kind).toBe("transfer");
  });

  it("commit resolves from position without stale lock", () => {
    const locked = PAIR_ZONES[1]!;
    const { zone: z } = resolveDropFromBounds(
      bounds(131, 243),
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true, commit: true },
      locked,
    );
    expect(z?.kind).toBe("defend");
  });

  it("overlap fallback locks zone when only defend candidate", () => {
    const zones = [zone("defend", 0, 100, 200)];
    const cx = 85;
    const cy = 243;
    expect(pointInRect(cx, cy, hitRect(zones[0]!))).toBe(false);

    const { zone: z, locked } = resolveDropFromBounds(
      bounds(cx, cy, 42, 59),
      zones,
      { kinds: ["defend"], tableIndices: [0] },
    );
    expect(z?.kind).toBe("defend");
    expect(locked).toEqual(z);
  });
});

describe("releaseLockedZone", () => {
  const defend = PAIR_ZONES[0]!;
  const transfer = PAIR_ZONES[1]!;

  it("keeps defend lock until center crosses midpoint + hysteresis", () => {
    expect(releaseLockedZone(bounds(170, 243), defend, transfer)).toBe(true);
    expect(releaseLockedZone(bounds(GAP_MID + 10, 243), defend, transfer)).toBe(false);
  });

  it("keeps transfer lock until center crosses midpoint - hysteresis", () => {
    expect(releaseLockedZone(bounds(174, 243), transfer, defend)).toBe(true);
    expect(releaseLockedZone(bounds(GAP_MID - 10, 243), transfer, defend)).toBe(false);
  });

  it("releases lock when center moves far away", () => {
    expect(releaseLockedZone(bounds(400, 400), defend, transfer)).toBe(false);
  });
});

describe("boundsForTableOverlap", () => {
  it("shrinks half extents to table card size", () => {
    const b = boundsForTableOverlap(bounds(100, 200, 42, 59));
    expect(b.halfW).toBe(31);
    expect(b.halfH).toBe(43.5);
    expect(b.centerX).toBe(100);
    expect(b.centerY).toBe(200);
  });
});

describe("sticky lock", () => {
  it("releases when center leaves locked zone", () => {
    const locked = PAIR_ZONES[1]!;
    const { zone: z } = resolveDropFromBounds(
      bounds(400, 400),
      PAIR_ZONES,
      { kinds: ["defend", "transfer"], tableIndices: [0], tableOverlap: true },
      locked,
    );
    expect(z?.kind).not.toBe("transfer");
  });
});
