import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

export interface PotBadgeProps {
  pot: number;
  buyIn: number;
}

/**
 * Phase 1 stub: shows the (virtual) pot and buy-in. In Phase 4 the pot will be
 * settled server-side via a Postgres transaction and credited to the winner.
 */
function PotBadgeComponent({ pot, buyIn }: PotBadgeProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.coin}>
        <Text style={styles.coinText}>$</Text>
      </View>
      <View>
        <Text style={styles.pot}>{pot}</Text>
        <Text style={styles.buyIn}>buy-in {buyIn}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.goldDim,
    gap: 8,
  },
  coin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  coinText: { color: colors.feltBottom, fontWeight: "900", fontSize: 14 },
  pot: { color: colors.textLight, fontWeight: "800", fontSize: 15, lineHeight: 16 },
  buyIn: { color: colors.textMuted, fontSize: 9, fontWeight: "700" },
});

export const PotBadge = React.memo(PotBadgeComponent);
