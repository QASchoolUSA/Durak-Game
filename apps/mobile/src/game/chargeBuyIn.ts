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
      const result = await args.spendCredits({
        amount: args.buyIn,
        reason: "buy_in",
      });
      args.syncCreditBalance(result.creditBalance);
      return true;
    } catch {
      return false;
    }
  }

  return args.deductCreditsLocal(args.buyIn);
}
