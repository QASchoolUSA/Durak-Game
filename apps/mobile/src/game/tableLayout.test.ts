import { describe, expect, it } from "vitest";
import {
  BASE_TABLE_CARD_W,
  computeTableLayout,
  tableColumns,
  tablePairRows,
} from "./tableLayout";

describe("tableColumns", () => {
  it("uses up to 3 columns for larger tables", () => {
    expect(tableColumns(6)).toBe(3);
    expect(tableColumns(2)).toBe(2);
  });
});

describe("computeTableLayout", () => {
  it("keeps base scale for a small table in a large slot", () => {
    const layout = computeTableLayout({
      pairCount: 2,
      slotWidth: 360,
      slotHeight: 280,
    });
    expect(layout.scale).toBe(1);
    expect(layout.cardW).toBe(BASE_TABLE_CARD_W);
  });

  it("keeps full-size cards when slot is large enough for six pairs", () => {
    const layout = computeTableLayout({
      pairCount: 6,
      slotWidth: 360,
      slotHeight: 280,
    });
    expect(layout.scale).toBe(1);
    expect(layout.cardW).toBe(BASE_TABLE_CARD_W);
    expect(layout.columns).toBe(3);
  });

  it("scales down cards in a tight slot for six pairs", () => {
    const layout = computeTableLayout({
      pairCount: 6,
      slotWidth: 260,
      slotHeight: 180,
    });
    expect(layout.scale).toBeLessThan(1);
    expect(layout.cardW).toBeGreaterThanOrEqual(54);
    expect(layout.columns).toBe(3);
  });

  it("scales down more aggressively when transfer choice is shown", () => {
    const withoutTransfer = computeTableLayout({
      pairCount: 6,
      slotWidth: 280,
      slotHeight: 200,
      hasTransferChoice: false,
    });
    const withTransfer = computeTableLayout({
      pairCount: 6,
      slotWidth: 280,
      slotHeight: 200,
      hasTransferChoice: true,
    });
    expect(withTransfer.scale).toBeLessThanOrEqual(withoutTransfer.scale);
    expect(withTransfer.cardW).toBeLessThanOrEqual(withoutTransfer.cardW);
  });

  it("uses tighter gap for five or more pairs", () => {
    const layout = computeTableLayout({
      pairCount: 6,
      slotWidth: 300,
      slotHeight: 250,
    });
    expect(layout.gap).toBe(10);
  });

  it("accepts custom base card sizes from layout system", () => {
    const layout = computeTableLayout({
      pairCount: 2,
      slotWidth: 360,
      slotHeight: 280,
      baseCardW: 58,
      baseCardH: 81,
    });
    expect(layout.cardW).toBe(58);
    expect(layout.cardH).toBe(81);
  });
});

describe("tablePairRows", () => {
  it("groups six pairs into two rows of three", () => {
    expect(tablePairRows(6, 3)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });
});
