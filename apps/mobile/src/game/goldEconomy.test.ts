import { describe, expect, it } from "vitest";
import {
  GRAVEYARD_GOLD_COST,
  REVEAL_GOLD_COST,
  RETURN_GOLD_COST,
  STARTING_GOLD,
  WIN_GOLD_REWARD,
  canAffordGold,
  goldCostForReason,
} from "./goldEconomy";

describe("goldEconomy", () => {
  it("uses planned ability costs", () => {
    expect(RETURN_GOLD_COST).toBe(0);
    expect(REVEAL_GOLD_COST).toBe(2);
    expect(GRAVEYARD_GOLD_COST).toBe(1);
  });

  it("maps spend reasons to costs", () => {
    expect(goldCostForReason("reveal")).toBe(2);
    expect(goldCostForReason("graveyard")).toBe(1);
  });

  it("checks affordability", () => {
    expect(canAffordGold(STARTING_GOLD, REVEAL_GOLD_COST)).toBe(true);
    expect(canAffordGold(1, REVEAL_GOLD_COST)).toBe(false);
    expect(canAffordGold(0, RETURN_GOLD_COST)).toBe(true);
  });

  it("defines starting balance and win reward", () => {
    expect(STARTING_GOLD).toBeGreaterThan(0);
    expect(WIN_GOLD_REWARD).toBeGreaterThan(0);
  });
});
