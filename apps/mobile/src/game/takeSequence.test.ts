import { describe, expect, it } from "vitest";
import {
  buildTakeFlightQueue,
  tableCardAnchorId,
} from "./takeSequence";
import { tableCardIdsFromPairs } from "./dealSequence";

describe("takeSequence", () => {
  it("collects attack and defense ids from table pairs", () => {
    const ids = tableCardIdsFromPairs([
      {
        attack: { id: "a1", suit: "hearts", rank: 6 },
        defense: { id: "d1", suit: "spades", rank: 10 },
      },
      {
        attack: { id: "a2", suit: "clubs", rank: 7 },
        defense: null,
      },
    ] as never);
    expect(ids).toEqual(["a1", "d1", "a2"]);
  });

  it("builds flight steps from table anchors to hand center", () => {
    const queue = buildTakeFlightQueue(
      {
        cardIds: ["a1"],
        anchors: {
          [tableCardAnchorId("a1")]: { x: 180, y: 220, width: 40, height: 56 },
        },
      },
      { x: 100, y: 500, width: 200, height: 80 },
      "solo",
    );
    expect(queue).toHaveLength(1);
    expect(queue[0]!.id).toBe("a1");
    expect(queue[0]!.fromX).toBeCloseTo(200);
    expect(queue[0]!.fromY).toBeCloseTo(248);
    expect(queue[0]!.toX).toBeCloseTo(200);
    expect(queue[0]!.toY).toBeCloseTo(540);
    expect(queue[0]!.flightMs).toBe(220);
  });
});
