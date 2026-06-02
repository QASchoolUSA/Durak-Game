import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows } from "../theme";

export interface PotBadgeProps {
  pot:   number;
  buyIn: number;
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-US");
}

function PotBadgeComponent({ pot, buyIn }: PotBadgeProps) {
  return (
    <View style={styles.wrap}>
      {/* Diamond chip icon */}
      <View style={styles.chip}>
        <Text style={styles.chipSymbol}>◆</Text>
      </View>

      {/* Pot */}
      <View style={styles.stat}>
        <Text style={styles.label}>POT</Text>
        <Text style={styles.potAmount} numberOfLines={1}>{formatAmount(pot)}</Text>
      </View>

      <View style={styles.divider} />

      {/* Buy-in */}
      <View style={styles.stat}>
        <Text style={styles.label}>BUY-IN</Text>
        <Text style={styles.buyInAmount} numberOfLines={1}>{formatAmount(buyIn)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(231, 192, 103, 0.28)",
    gap: 10,
    ...shadows.card,
  },

  // Chip icon
  chip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(231, 192, 103, 0.15)",
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSymbol: {
    color: colors.gold,
    fontSize: 13,
    lineHeight: 15,
  },

  // Stat column
  stat: { alignItems: "flex-start", justifyContent: "center" },
  label: {
    color: colors.textFaint,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 1,
  },
  potAmount: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  buyInAmount: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },

  // Vertical separator
  divider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 2,
    backgroundColor: "rgba(231, 192, 103, 0.18)",
  },
});

export const PotBadge = React.memo(PotBadgeComponent);
