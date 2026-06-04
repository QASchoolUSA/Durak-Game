import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { radius } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";
import type { UiTheme } from "../theme/uiThemes";

/** Shared height for bottom dock row (React + ability pills). */
export const DOCK_ROW_HEIGHT = 44;

export function createDockPillStyles(ui: UiTheme) {
  return StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: ui.panelBg,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
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
      fontSize: 18,
      lineHeight: 20,
    },
    label: {
      color: ui.textPrimary,
      fontWeight: "700",
      fontSize: 14,
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: ui.badgeBg,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 2,
    },
    badgeText: {
      color: ui.badgeText,
      fontSize: 10,
      fontWeight: "800",
    },
    countdown: {
      color: ui.accent,
      fontWeight: "800",
      fontSize: 14,
      minWidth: 14,
      textAlign: "center",
    },
  });
}

export function useDockPillStyles() {
  const ui = useUiTheme();
  return useMemo(() => createDockPillStyles(ui), [ui]);
}
