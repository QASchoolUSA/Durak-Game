import React from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { radius } from "../theme";

export type EconomyChipSize = "sm" | "md";

export interface EconomyChipProps {
  icon: React.ReactNode;
  value: string;
  valueColor: string;
  iconWellStyle?: ViewStyle;
  valueStyle?: TextStyle;
  accessibilityLabel: string;
  size?: EconomyChipSize;
}

const ICON_SIZE = { sm: 20, md: 22 } as const;
const VALUE_SIZE = { sm: 12, md: 13 } as const;
const PADDING = { sm: 4, md: 5 } as const;

export function EconomyChip({
  icon,
  value,
  valueColor,
  iconWellStyle,
  valueStyle,
  accessibilityLabel,
  size = "sm",
}: EconomyChipProps) {
  const iconSize = ICON_SIZE[size];
  const fontSize = VALUE_SIZE[size];
  const pad = PADDING[size];

  return (
    <View
      style={[styles.segment, { paddingHorizontal: pad, paddingVertical: pad - 1 }]}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={[
          styles.iconWell,
          {
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize / 2,
          },
          iconWellStyle,
        ]}
      >
        {typeof icon === "string" ? (
          <Text style={[styles.iconText, { fontSize: size === "sm" ? 10 : 11 }]}>{icon}</Text>
        ) : (
          icon
        )}
      </View>
      <Text
        style={[
          styles.value,
          { color: valueColor, fontSize, lineHeight: fontSize + 2 },
          valueStyle,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconWell: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconText: {
    lineHeight: 12,
    textAlign: "center",
  },
  value: {
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
