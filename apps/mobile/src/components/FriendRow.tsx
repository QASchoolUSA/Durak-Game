import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, spacing, typography } from "../theme";

export type RowActionKind = "primary" | "neutral" | "danger";

export interface RowAction {
  key: string;
  label: string;
  kind?: RowActionKind;
  onPress: () => void;
  disabled?: boolean;
}

export interface FriendRowProps {
  displayName: string;
  handle: string;
  subtitle?: string;
  actions?: RowAction[];
}

export function FriendRow({ displayName, handle, subtitle, actions }: FriendRowProps) {
  const ui = useUiTheme();
  return (
    <View style={[styles.row, { borderBottomColor: ui.panelBorderSoft }]}>
      <View style={styles.info}>
        <Text style={[styles.name, { color: ui.textPrimary }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.handle, { color: ui.textMuted }]} numberOfLines={1}>
          {subtitle ?? `@${handle}`}
        </Text>
      </View>
      <View style={styles.actions}>
        {actions?.map((a) => {
          const bg =
            a.kind === "primary"
              ? ui.accent
              : a.kind === "danger"
                ? "transparent"
                : "transparent";
          const borderColor =
            a.kind === "danger" ? ui.panelBorderSoft : ui.panelBorder;
          const color =
            a.kind === "primary"
              ? ui.badgeText
              : a.kind === "danger"
                ? ui.textMuted
                : ui.textPrimary;
          return (
            <Pressable
              key={a.key}
              disabled={a.disabled}
              onPress={a.onPress}
              style={[
                styles.action,
                { backgroundColor: bg, borderColor },
                a.disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.actionText, { color }]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  info: { flex: 1 },
  name: { ...typography.heading },
  handle: { ...typography.caption },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  action: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
  },
  actionText: { ...typography.caption, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
