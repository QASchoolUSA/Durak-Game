import React, { createContext, useContext, useMemo } from "react";
import { usePreferencesStore } from "../game/preferencesStore";
import { DEFAULT_APPEARANCE } from "./appearanceThemes";
import { type CardTheme, getCardTheme } from "./cardThemes";

const CardThemeContext = createContext<CardTheme>(getCardTheme(DEFAULT_APPEARANCE));

export function CardThemeProvider({ children }: { children: React.ReactNode }) {
  const cardDesign = usePreferencesStore((s) => s.cardDesign);
  const theme = useMemo(() => getCardTheme(cardDesign), [cardDesign]);

  return (
    <CardThemeContext.Provider value={theme}>{children}</CardThemeContext.Provider>
  );
}

export function useCardTheme(): CardTheme {
  return useContext(CardThemeContext);
}
