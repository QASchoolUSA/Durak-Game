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

  it("always returns full-size cards even in tight slots", () => {
    const layout = computeTableLayout({
      pairCount: 6,
      slotWidth: 260,
      slotHeight: 180,
    });
    expect(layout.scale).toBe(1);
    expect(layout.cardW).toBe(BASE_TABLE_CARD_W);
    expect(layout.columns).toBe(3);
  });

  it("uses tighter gap for five or more pairs", () => {
    const layout = computeTableLayout({
      pairCount: 6,
      slotWidth: 300,
      slotHeight: 250,
    });
    expect(layout.gap).toBe(10);
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
