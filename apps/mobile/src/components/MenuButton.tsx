import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, radius, shadows, typography } from "../theme";
import { trigger } from "../feedback/haptics";

const SPRING = { damping: 14, stiffness: 320, mass: 0.6 };

export type MenuButtonVariant = "primary" | "secondary" | "ghost";

export interface MenuButtonProps {
  label: string;
  variant?: MenuButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  icon?: string;
}

function MenuButtonComponent({
  label,
  variant = "primary",
  onPress,
  disabled = false,
  icon,
}: MenuButtonProps) {
  const scale = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bg =
    variant === "primary"
      ? colors.gold
      : variant === "secondary"
        ? "rgba(9, 46, 31, 0.85)"
        : "transparent";

  const borderColor =
    variant === "primary"
      ? "transparent"
      : variant === "secondary"
        ? colors.goldDim
        : "rgba(231, 192, 103, 0.35)";

  const textColor =
    variant === "primary" ? colors.feltBottom : colors.textLight;

  const extraShadow =
    variant === "primary" ? shadows.goldGlow : undefined;

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
  disabled: { opacity: 0.40 },
});

export const MenuButton = React.memo(MenuButtonComponent);
