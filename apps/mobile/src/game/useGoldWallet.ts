import { useEffect, useRef } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGameStore } from "./store";

export function useGoldWallet() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const goldHydrated = useGameStore((s) => s.goldHydrated);
  const syncGoldBalance = useGameStore((s) => s.syncGoldBalance);
  const ensuredRef = useRef(false);

  const ensureWallet = useMutation(api.wallets.ensureWallet);
  const wallet = useQuery(
    api.wallets.getWallet,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (isLoading || !isAuthenticated || !goldHydrated || ensuredRef.current) return;
    ensuredRef.current = true;

    void ensureWallet({
      localBalance: useGameStore.getState().goldBalance,
    }).then((result) => {
      syncGoldBalance(result.goldBalance);
    });
  }, [isLoading, isAuthenticated, goldHydrated, ensureWallet, syncGoldBalance]);

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
}
