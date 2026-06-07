import { describe, expect, it } from "vitest";
import { MATCH_BUY_IN, matchPot } from "../src/matchEconomy";

describe("matchPot", () => {
  it("multiplies buy-in by player count", () => {
    expect(matchPot(2)).toBe(200);
    expect(matchPot(6, MATCH_BUY_IN)).toBe(600);
  });

  it("returns 0 for invalid player counts", () => {
    expect(matchPot(0)).toBe(0);
    expect(matchPot(-1)).toBe(0);
  });
});
