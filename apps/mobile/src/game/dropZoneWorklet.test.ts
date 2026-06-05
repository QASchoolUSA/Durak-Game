import { describe, expect, it } from "vitest";
import {
  decodeHoverKey,
  encodeHoverKey,
  hitTestDropZones,
} from "./dropZoneWorklet";

describe("dropZoneWorklet", () => {
  it("encodes and decodes hover keys", () => {
    expect(encodeHoverKey("defend", 2)).toBe(4);
    expect(encodeHoverKey("transfer", 2)).toBe(5);
    expect(decodeHoverKey(4)).toEqual({ kind: "defend", tableIndex: 2 });
    expect(decodeHoverKey(5)).toEqual({ kind: "transfer", tableIndex: 2 });
    expect(decodeHoverKey(-1)).toBeNull();
  });

  it("hit-tests nearest zone by aim point", () => {
    const zones = [
      { kind: "defend" as const, tableIndex: 0, x: 100, y: 200, width: 62, height: 87 },
      { kind: "transfer" as const, tableIndex: 0, x: 182, y: 200, width: 62, height: 87 },
    ];
    const key = hitTestDropZones(
      {
        centerX: 131,
        centerY: 243,
        halfW: 42,
        halfH: 59,
        aimX: 130,
        aimY: 240,
      },
      zones,
    );
    expect(key).toBe(encodeHoverKey("defend", 0));
  });
});
