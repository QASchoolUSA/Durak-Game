import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";
import { CoinIcon } from "./CoinIcon";
import { EconomyChip } from "./EconomyChip";
import { formatEconomyAmount } from "./economyFormat";

export interface EconomyBarProps {
  goldBalance: number;
  creditBalance: number;
  variant?: "home" | "game";
}

function SegmentDivider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

export function EconomyBar({
  goldBalance,
  creditBalance,
  variant = "home",
}: EconomyBarProps) {
  const ui = useUiTheme();
  const dividerColor = ui.panelBorderSoft;

  const a11yLabel = `Credits ${creditBalance.toLocaleString("en-US")}, gold ${goldBalance.toLocaleString("en-US")}`;

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
        icon={<CoinIcon variant="credit" size={16} />}
        value={formatEconomyAmount(creditBalance)}
        valueColor={colors.success}
        accessibilityLabel={`Credits ${creditBalance.toLocaleString("en-US")}`}
        iconWellStyle={{
          backgroundColor: "rgba(70, 167, 88, 0.15)",
          borderColor: "rgba(70, 167, 88, 0.45)",
        }}
      />
      <SegmentDivider color={dividerColor} />
      <EconomyChip
        icon={<CoinIcon variant="gold" size={16} />}
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
