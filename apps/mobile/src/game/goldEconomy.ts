/** Gold coin costs and rewards (client + tests). Mirror in convex/lib/goldEconomy.ts. */

export const STARTING_GOLD = 10;
export const MAX_WALLET_MIGRATION = 500;
export const WIN_GOLD_REWARD = 10;

export const RETURN_GOLD_COST = 0;
export const REVEAL_GOLD_COST = 2;
export const GRAVEYARD_GOLD_COST = 1;

export type GoldSpendReason = "reveal" | "graveyard";

export function goldCostForReason(reason: GoldSpendReason): number {
  switch (reason) {
    case "reveal":
      return REVEAL_GOLD_COST;
    case "graveyard":
      return GRAVEYARD_GOLD_COST;
  }
}

export function canAffordGold(balance: number, cost: number): boolean {
  return cost <= 0 || balance >= cost;
}
