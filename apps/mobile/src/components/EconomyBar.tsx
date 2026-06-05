import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";
import { EconomyChip } from "./EconomyChip";
import { formatEconomyAmount } from "./economyFormat";

export interface EconomyBarProps {
  goldBalance: number;
  pot?: number;
  buyIn?: number;
}

function SegmentDivider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

export function EconomyBar({
  goldBalance,
  pot = 0,
  buyIn = 0,
}: EconomyBarProps) {
  const ui = useUiTheme();
  const dividerColor = ui.panelBorderSoft;

  const a11yLabel = `Pot ${pot.toLocaleString("en-US")}, buy-in ${buyIn.toLocaleString("en-US")}, gold ${goldBalance.toLocaleString("en-US")}`;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: ui.panelBg,
          borderColor: ui.panelBorderSoft,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
    >
      <EconomyChip
        icon="◆"
        value={formatEconomyAmount(pot)}
        valueColor={ui.accent}
        accessibilityLabel={`Pot ${pot.toLocaleString("en-US")}`}
        iconWellStyle={{
          backgroundColor: ui.accentSoft,
          borderColor: ui.accent,
        }}
      />
      <SegmentDivider color={dividerColor} />
      <EconomyChip
        icon="↥"
        value={formatEconomyAmount(buyIn)}
        valueColor={ui.textMuted}
        accessibilityLabel={`Buy-in ${buyIn.toLocaleString("en-US")}`}
        iconWellStyle={{
          backgroundColor: ui.feltEdge,
          borderColor: ui.panelBorderSoft,
        }}
      />
      <SegmentDivider color={dividerColor} />
      <EconomyChip
        icon="🪙"
        value={formatEconomyAmount(goldBalance)}
        valueColor={colors.gold}
        accessibilityLabel={`Gold ${goldBalance.toLocaleString("en-US")}`}
        iconWellStyle={{
          backgroundColor: "rgba(231, 192, 103, 0.18)",
          borderColor: colors.gold,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    flexShrink: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
    maxWidth: "100%",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 3,
    opacity: 0.9,
  },
});
