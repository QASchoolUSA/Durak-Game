import { describe, expect, it } from "vitest";
import { formatEconomyAmount } from "./economyFormat";

describe("formatEconomyAmount", () => {
  it("formats small numbers with locale grouping", () => {
    expect(formatEconomyAmount(999)).toBe("999");
    expect(formatEconomyAmount(600)).toBe("600");
  });

  it("abbreviates thousands", () => {
    expect(formatEconomyAmount(1000)).toBe("1k");
    expect(formatEconomyAmount(1234)).toBe("1.2k");
    expect(formatEconomyAmount(12000)).toBe("12k");
  });
});
