import { StyleSheet } from "react-native";
import { colors, radius } from "../theme";

/** Shared height for bottom dock row (React + ability pills). */
export const DOCK_ROW_HEIGHT = 44;

export const dockPillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  pillActive: {
    borderColor: colors.gold,
    backgroundColor: colors.feltEdge,
  },
  pillUrgent: {
    borderColor: colors.gold,
    backgroundColor: "rgba(231, 192, 103, 0.14)",
  },
  pillDisabled: {
    opacity: 0.38,
    borderColor: colors.separator,
  },
  labelDisabled: {
    color: colors.textFaint,
  },
  icon: {
    fontSize: 18,
    lineHeight: 20,
  },
  label: {
    color: colors.textLight,
    fontWeight: "700",
    fontSize: 14,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  badgeText: {
    color: colors.feltBottom,
    fontSize: 10,
    fontWeight: "800",
  },
  countdown: {
    color: colors.gold,
    fontWeight: "800",
    fontSize: 14,
    minWidth: 14,
    textAlign: "center",
  },
});
