export async function chargeBuyIn(args: {
  convexEnabled: boolean;
  ensureAuthenticated: () => Promise<void>;
  spendCredits: (args: {
    amount: number;
    reason: string;
  }) => Promise<{ creditBalance: number }>;
  buyIn: number;
  syncCreditBalance: (balance: number) => void;
  deductCreditsLocal: (amount: number) => boolean;
}): Promise<boolean> {
  if (args.convexEnabled) {
    try {
      await args.ensureAuthenticated();
      let result;
      try {
        result = await args.spendCredits({
          amount: args.buyIn,
          reason: "buy_in",
        });
      } catch (err: any) {
        if (err.message && err.message.includes("Not authenticated")) {
          // Wait for the WebSocket to receive the new auth token
          await new Promise((r) => setTimeout(r, 500));
          result = await args.spendCredits({
            amount: args.buyIn,
            reason: "buy_in",
          });
        } else {
          throw err;
        }
      }
      args.syncCreditBalance(result.creditBalance);
      return true;
    } catch (err) {
      console.warn("chargeBuyIn failed:", err);
      return false;
    }
  }

  return args.deductCreditsLocal(args.buyIn);
}
