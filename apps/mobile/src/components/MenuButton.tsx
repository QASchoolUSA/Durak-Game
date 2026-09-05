import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameLayout } from "../theme/useGameLayout";
import { trigger } from "../feedback/haptics";

export type MenuButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface MenuButtonProps {
  label: string;
  variant?: MenuButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  icon?: string;
  badgeCount?: number;
}

function MenuButtonComponent({
  label,
  variant = "primary",
  onPress,
  disabled = false,
  icon,
  badgeCount = 0,
}: MenuButtonProps) {
  const ui = useUiTheme();
  const lay = useGameLayout();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: "100%" },
        btn: {
          height: lay.s(54),
          borderRadius: radius.pill,
          borderWidth: 1.5,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: lay.s(10),
          paddingHorizontal: lay.s(24),
        },
        icon: {
          fontSize: lay.s(18),
        },
        label: {
          ...lay.typography.heading,
          letterSpacing: 1.5,
        },
        badge: {
          minWidth: lay.s(22),
          height: lay.s(22),
          borderRadius: lay.s(11),
          paddingHorizontal: lay.s(6),
          alignItems: "center",
          justifyContent: "center",
        },
        badgeText: {
          ...lay.typography.caption,
          fontWeight: "800",
        },
        disabled: { opacity: 0.4 },
      }),
    [lay],
  );

  const bg =
    variant === "primary"
      ? ui.accent
      : variant === "secondary"
        ? ui.panelBg
        : variant === "danger"
          ? "rgba(229, 72, 77, 0.08)"
          : "transparent";

  const borderColor =
    variant === "primary"
      ? "transparent"
      : variant === "secondary"
        ? ui.panelBorder
        : variant === "danger"
          ? "rgba(229, 72, 77, 0.45)"
          : ui.panelBorderSoft;

  const textColor =
    variant === "primary"
      ? ui.badgeText
      : variant === "danger"
        ? colors.danger
        : ui.textPrimary;

  const extraShadow =
    variant === "primary"
      ? {
          shadowColor: ui.accent,
          shadowOpacity: 0.7,
          shadowRadius: lay.s(20),
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        }
      : undefined;

  return (
    <View style={[styles.wrap, extraShadow]}>
      <Pressable
        onPressIn={() => {
          trigger("uiTap");
        }}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: bg, borderColor },
          disabled && styles.disabled,
          pressed && !disabled ? { transform: [{ scale: 0.96 }] } : null,
        ]}
      >
        {icon ? (
          <Text style={[styles.icon, { color: textColor }]}>{icon}</Text>
        ) : null}
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        {badgeCount > 0 ? (
          <View
            style={[styles.badge, { backgroundColor: ui.badgeBg ?? ui.accent }]}
          >
            <Text style={[styles.badgeText, { color: ui.badgeText }]}>
              {badgeCount > 9 ? "9+" : badgeCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export const MenuButton = React.memo(MenuButtonComponent);
