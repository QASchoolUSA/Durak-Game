import React, { createContext, useContext } from "react";
import type { GameLayoutResult } from "./gameLayout";
import { useGameLayout } from "./useGameLayout";

const GameLayoutContext = createContext<GameLayoutResult | null>(null);

export function GameLayoutProvider({ children }: { children: React.ReactNode }) {
  const layout = useGameLayout();
  return (
    <GameLayoutContext.Provider value={layout}>{children}</GameLayoutContext.Provider>
  );
}

/** Layout from GameScreen provider — must be inside GameLayoutProvider. */
export function useGameLayoutContext(): GameLayoutResult {
  const ctx = useContext(GameLayoutContext);
  if (!ctx) {
    throw new Error("useGameLayoutContext must be used within GameLayoutProvider");
  }
  return ctx;
}
