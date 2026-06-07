import { describe, expect, it } from "vitest";
import { MATCH_BUY_IN, STARTING_CREDITS } from "./creditEconomy";

describe("creditEconomy", () => {
  it("defines starting credits and match buy-in", () => {
    expect(STARTING_CREDITS).toBe(1000);
    expect(MATCH_BUY_IN).toBe(100);
  });
});
