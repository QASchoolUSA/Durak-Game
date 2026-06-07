import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { convexEnabled } from "./convexClient";
import { soloMatchEndCreditDelta } from "./matchSettlement";
import { useGameStore } from "./store";

export function useSoloCreditSettlement() {
  const { isAuthenticated } = useConvexAuth();
  const awardCredits = useMutation(api.wallets.awardCreditsPublic);
  const syncCreditBalance = useGameStore((s) => s.syncCreditBalance);
  const settledKeyRef = useRef<string | null>(null);

  const playMode = useGameStore((s) => s.playMode);
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const buyIn = useGameStore((s) => s.buyIn);
  const numPlayers = useGameStore((s) => s.numPlayers);
  const lastMoveAt = useGameStore((s) => s.lastMoveAt);

  useEffect(() => {
    if (!convexEnabled || !isAuthenticated) return;
    if (playMode !== "solo" || game?.phase !== "gameOver") return;

    const settlementKey = `${lastMoveAt}:${game.loserId ?? "draw"}:${game.finishedOrder.join(",")}`;
    if (settledKeyRef.current === settlementKey) return;

    const delta = soloMatchEndCreditDelta({
      isDraw: game.loserId === null,
      humanIsWinner: (game.finishedOrder[0] ?? null) === humanId,
      numPlayers,
      buyIn,
    });
    if (delta <= 0) {
      settledKeyRef.current = settlementKey;
      return;
    }

    settledKeyRef.current = settlementKey;
    void awardCredits({
      amount: delta,
      reason: game.loserId === null ? "draw_refund" : "win_pot",
    })
      .then((result) => {
        syncCreditBalance(result.creditBalance);
      })
      .catch(() => {
        settledKeyRef.current = null;
      });
  }, [
    isAuthenticated,
    playMode,
    game,
    humanId,
    buyIn,
    numPlayers,
    lastMoveAt,
    awardCredits,
    syncCreditBalance,
  ]);

  useEffect(() => {
    if (playMode !== "solo" || game?.phase !== "gameOver") {
      settledKeyRef.current = null;
    }
  }, [playMode, game?.phase]);
}
