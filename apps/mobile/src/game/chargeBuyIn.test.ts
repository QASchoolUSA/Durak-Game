import { describe, expect, it, vi } from "vitest";
import { chargeBuyIn } from "./chargeBuyIn";

describe("chargeBuyIn", () => {
  it("deducts locally when Convex is disabled", async () => {
    const deductCreditsLocal = vi.fn().mockReturnValue(true);
    const spendCredits = vi.fn();

    const ok = await chargeBuyIn({
      convexEnabled: false,
      ensureAuthenticated: vi.fn(),
      spendCredits,
      buyIn: 100,
      syncCreditBalance: vi.fn(),
      deductCreditsLocal,
    });

    expect(ok).toBe(true);
    expect(deductCreditsLocal).toHaveBeenCalledWith(100);
    expect(spendCredits).not.toHaveBeenCalled();
  });

  it("charges server wallet when Convex is enabled", async () => {
    const syncCreditBalance = vi.fn();
    const spendCredits = vi.fn().mockResolvedValue({ creditBalance: 900 });

    const ok = await chargeBuyIn({
      convexEnabled: true,
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      spendCredits,
      buyIn: 100,
      syncCreditBalance,
      deductCreditsLocal: vi.fn(),
    });

    expect(ok).toBe(true);
    expect(spendCredits).toHaveBeenCalledWith({ amount: 100, reason: "buy_in" });
    expect(syncCreditBalance).toHaveBeenCalledWith(900);
  });

  it("returns false when server spend fails", async () => {
    const ok = await chargeBuyIn({
      convexEnabled: true,
      ensureAuthenticated: vi.fn().mockResolvedValue(undefined),
      spendCredits: vi.fn().mockRejectedValue(new Error("Not enough credits")),
      buyIn: 100,
      syncCreditBalance: vi.fn(),
      deductCreditsLocal: vi.fn(),
    });

    expect(ok).toBe(false);
  });
});
