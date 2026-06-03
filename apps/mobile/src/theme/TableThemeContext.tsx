import React, { createContext, useContext, useMemo } from "react";
import { usePreferencesStore } from "../game/preferencesStore";
import { DEFAULT_APPEARANCE } from "./appearanceThemes";
import { type TableTheme, getTableTheme } from "./tableThemes";

const TableThemeContext = createContext<TableTheme>(getTableTheme(DEFAULT_APPEARANCE));

export function TableThemeProvider({ children }: { children: React.ReactNode }) {
  const tableDesign = usePreferencesStore((s) => s.tableDesign);
  const theme = useMemo(() => getTableTheme(tableDesign), [tableDesign]);

  return (
    <TableThemeContext.Provider value={theme}>{children}</TableThemeContext.Provider>
  );
}

export function useTableTheme(): TableTheme {
  return useContext(TableThemeContext);
}
