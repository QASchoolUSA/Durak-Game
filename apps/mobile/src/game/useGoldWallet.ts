import { useEffect, useRef } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGameStore } from "./store";

export function useGoldWallet() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const goldHydrated = useGameStore((s) => s.goldHydrated);
  const creditHydrated = useGameStore((s) => s.creditHydrated);
  const syncGoldBalance = useGameStore((s) => s.syncGoldBalance);
  const syncCreditBalance = useGameStore((s) => s.syncCreditBalance);
  const ensuredRef = useRef(false);

  const ensureWallet = useMutation(api.wallets.ensureWallet);
  const wallet = useQuery(
    api.wallets.getWallet,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (
      isLoading ||
      !isAuthenticated ||
      !goldHydrated ||
      !creditHydrated ||
      ensuredRef.current
    ) {
      return;
    }
    ensuredRef.current = true;

    const state = useGameStore.getState();
    void ensureWallet({
      localGoldBalance: state.goldBalance,
      localCreditBalance: state.creditBalance,
    }).then((result) => {
      syncGoldBalance(result.goldBalance);
      syncCreditBalance(result.creditBalance);
    });
  }, [
    isLoading,
    isAuthenticated,
    goldHydrated,
    creditHydrated,
    ensureWallet,
    syncGoldBalance,
    syncCreditBalance,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      ensuredRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (wallet?.goldBalance != null) {
      syncGoldBalance(wallet.goldBalance);
    }
  }, [wallet?.goldBalance, syncGoldBalance]);

  useEffect(() => {
    if (wallet?.creditBalance != null) {
      syncCreditBalance(wallet.creditBalance);
    }
  }, [wallet?.creditBalance, syncCreditBalance]);
}
