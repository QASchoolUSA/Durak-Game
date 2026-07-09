import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { radius } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameLayout } from "../theme/useGameLayout";
import type { UiTheme } from "../theme/uiThemes";

/** Shared height for bottom dock row (React + ability pills). */
export const DOCK_ROW_HEIGHT_BASE = 44;

export function createDockPillStyles(ui: UiTheme, s: (n: number) => number) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: s(6),
      backgroundColor: ui.panelBg,
      borderRadius: radius.pill,
      paddingHorizontal: s(14),
      paddingVertical: s(8),
      borderWidth: 1,
      borderColor: ui.accentMuted,
    },
    pillActive: {
      borderColor: ui.accent,
      backgroundColor: ui.feltEdge,
    },
    pillUrgent: {
      borderColor: ui.accent,
      backgroundColor: ui.urgentBg,
    },
    pillDisabled: {
      opacity: 0.38,
      borderColor: ui.panelBorderSoft,
    },
    labelDisabled: {
      color: ui.textFaint,
    },
    icon: {
      fontSize: s(18),
      lineHeight: s(20),
    },
    label: {
      color: ui.textPrimary,
      fontWeight: "700",
      fontSize: s(14),
    },
    badge: {
      minWidth: s(18),
      height: s(18),
      borderRadius: s(9),
      paddingHorizontal: s(4),
      backgroundColor: ui.badgeBg,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: s(2),
    },
    badgeText: {
      color: ui.badgeText,
      fontSize: s(10),
      fontWeight: "800",
    },
    countdown: {
      color: ui.accent,
      fontWeight: "800",
      fontSize: s(14),
      minWidth: s(14),
      textAlign: "center",
    },
  });
}

export function useDockPillStyles() {
  const ui = useUiTheme();
  const lay = useGameLayout();
  return useMemo(
    () => createDockPillStyles(ui, lay.s),
    [ui, lay.s],
  );
}

export function useDockRowHeight(): number {
  const lay = useGameLayout();
  return lay.s(DOCK_ROW_HEIGHT_BASE);
}

/** @deprecated Use useDockRowHeight() */
export const DOCK_ROW_HEIGHT = DOCK_ROW_HEIGHT_BASE;
