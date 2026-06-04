import React, { createContext, useContext, useMemo } from "react";
import { usePreferencesStore } from "../game/preferencesStore";
import { DEFAULT_APPEARANCE } from "./appearanceThemes";
import { type UiTheme, getUiTheme } from "./uiThemes";

const UiThemeContext = createContext<UiTheme>(getUiTheme(DEFAULT_APPEARANCE));

export function UiThemeProvider({ children }: { children: React.ReactNode }) {
  const cardDesign = usePreferencesStore((s) => s.cardDesign);
  const theme = useMemo(() => getUiTheme(cardDesign), [cardDesign]);

  return <UiThemeContext.Provider value={theme}>{children}</UiThemeContext.Provider>;
}

export function useUiTheme(): UiTheme {
  return useContext(UiThemeContext);
}
