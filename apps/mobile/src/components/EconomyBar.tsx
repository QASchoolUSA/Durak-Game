import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameLayout } from "../theme/useGameLayout";
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
  const lay = useGameLayout();
  const dividerColor = ui.panelBorderSoft;
  const iconSize = lay.s(16);

  const barStyle = useMemo(
    () => ({
      backgroundColor: ui.panelBg,
      borderColor: ui.panelBorderSoft,
      borderRadius: radius.pill,
      paddingHorizontal: lay.s(3),
      paddingVertical: lay.s(2),
    }),
    [ui.panelBg, ui.panelBorderSoft, lay.s],
  );

  const a11yLabel = `Credits ${creditBalance.toLocaleString("en-US")}, gold ${goldBalance.toLocaleString("en-US")}`;

  return (
    <View
      style={[styles.bar, barStyle]}
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
    >
      <EconomyChip
        icon={<CoinIcon variant="credit" size={iconSize} />}
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
        icon={<CoinIcon variant="gold" size={iconSize} />}
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
    borderWidth: 1,
    maxWidth: "100%",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 3,
    opacity: 0.9,
  },
});
