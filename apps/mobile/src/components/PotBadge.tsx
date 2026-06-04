import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, shadows } from "../theme";

export interface PotBadgeProps {
  pot:   number;
  buyIn: number;
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-US");
}

function PotBadgeComponent({ pot, buyIn }: PotBadgeProps) {
  const ui = useUiTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: ui.panelBg,
          borderColor: ui.panelBorder,
        },
      ]}
    >
      <View
        style={[
          styles.chip,
          {
            backgroundColor: ui.accentSoft,
            borderColor: ui.accent,
          },
        ]}
      >
        <Text style={[styles.chipSymbol, { color: ui.accent }]}>◆</Text>
      </View>

      <View style={styles.stat}>
        <Text style={[styles.label, { color: ui.textFaint }]}>POT</Text>
        <Text style={[styles.potAmount, { color: ui.accent }]} numberOfLines={1}>
          {formatAmount(pot)}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

      <View style={styles.stat}>
        <Text style={[styles.label, { color: ui.textFaint }]}>BUY-IN</Text>
        <Text style={[styles.buyInAmount, { color: ui.textMuted }]} numberOfLines={1}>
          {formatAmount(buyIn)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 10,
    ...shadows.card,
  },
  chip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSymbol: {
    fontSize: 13,
    lineHeight: 15,
  },
  stat: { alignItems: "flex-start", justifyContent: "center" },
  label: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 1,
  },
  potAmount: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  buyInAmount: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 2,
  },
});

export const PotBadge = React.memo(PotBadgeComponent);
