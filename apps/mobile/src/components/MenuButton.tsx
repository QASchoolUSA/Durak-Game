import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { radius, typography } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";
import { trigger } from "../feedback/haptics";

const SPRING = { damping: 14, stiffness: 320, mass: 0.6 };

export type MenuButtonVariant = "primary" | "secondary" | "ghost";

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
  const scale = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bg =
    variant === "primary"
      ? ui.accent
      : variant === "secondary"
        ? ui.panelBg
        : "transparent";

  const borderColor =
    variant === "primary"
      ? "transparent"
      : variant === "secondary"
        ? ui.panelBorder
        : ui.panelBorderSoft;

  const textColor =
    variant === "primary" ? ui.badgeText : ui.textPrimary;

  const extraShadow =
    variant === "primary"
      ? {
          shadowColor: ui.accent,
          shadowOpacity: 0.70,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        }
      : undefined;

  return (
    <View style={[styles.wrap, extraShadow]}>
      <Animated.View style={aStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.96, SPRING);
          trigger("uiTap");
        }}
        onPressOut={() => {
          scale.value = withSpring(1.0, SPRING);
        }}
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.btn,
          { backgroundColor: bg, borderColor },
          disabled && styles.disabled,
        ]}
      >
        {icon ? (
          <Text style={[styles.icon, { color: textColor }]}>{icon}</Text>
        ) : null}
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        {badgeCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: ui.badgeBg ?? ui.accent }]}>
            <Text style={[styles.badgeText, { color: ui.badgeText }]}>
              {badgeCount > 9 ? "9+" : badgeCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  btn: {
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    ...typography.heading,
    letterSpacing: 1.5,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    ...typography.caption,
    fontWeight: "800",
  },
  disabled: { opacity: 0.40 },
});

export const MenuButton = React.memo(MenuButtonComponent);
