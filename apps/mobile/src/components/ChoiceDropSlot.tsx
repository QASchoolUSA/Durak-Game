import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../theme";

export type ChoiceDropVariant = "beat" | "transfer";

const VARIANT_CONFIG = {
  beat: {
    borderIdle: "rgba(70, 167, 88, 0.45)",
    borderActive: colors.success,
    glowColor: colors.success,
    icon: "\u2713",
    badgeBg: colors.success,
    iconColor: colors.goldDim,
    iconColorActive: colors.gold,
    fillIdle: "transparent",
    fillActive: "transparent",
  },
  transfer: {
    borderIdle: "rgba(154, 123, 54, 0.55)",
    borderActive: colors.gold,
    glowColor: colors.gold,
    icon: "\u21AA",
    badgeBg: colors.gold,
    iconColor: colors.goldDim,
    iconColorActive: colors.gold,
    fillIdle: "rgba(7, 42, 32, 0.55)",
    fillActive: "rgba(15, 53, 40, 0.72)",
  },
} as const;

export interface ChoiceDropSlotProps {
  variant: ChoiceDropVariant;
  width: number;
  height: number;
  active: boolean;
  dimmed: boolean;
  /** Non-interactive slot (e.g. transfer unavailable this round). */
  disabled?: boolean;
  /** Beat slot: attack card. Transfer slot: omit. */
  children?: React.ReactNode;
}

function ChoiceDropSlotComponent({
  variant,
  width,
  height,
  active,
  dimmed,
  disabled = false,
  children,
}: ChoiceDropSlotProps) {
  const config = VARIANT_CONFIG[variant];
  const scale = useSharedValue(1);
  const isHighlighted = active && !disabled;

  useEffect(() => {
    scale.value = withTiming(isHighlighted ? 1.03 : 1, { duration: 120 });
  }, [isHighlighted, scale]);

  const animatedInner = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedOuter = useAnimatedStyle(() => ({
    opacity: disabled ? 0.42 : dimmed ? 0.38 : 1,
  }));

  const iconSize = Math.round(width * 0.38);
  const badgeSize = Math.round(width * 0.28);
  const badgeFont = Math.round(badgeSize * 0.55);

  return (
    <Animated.View style={[{ width, height }, animatedOuter]}>
      <Animated.View style={[{ width, height }, animatedInner]}>
      <View
        style={[
          styles.frame,
          { width, height },
          {
            borderColor: isHighlighted
              ? config.borderActive
              : disabled
                ? "rgba(185, 198, 190, 0.25)"
                : config.borderIdle,
            borderStyle: isHighlighted ? "solid" : "dashed",
            backgroundColor: isHighlighted ? config.fillActive : config.fillIdle,
          },
          isHighlighted && {
            shadowColor: config.glowColor,
            shadowOpacity: 0.55,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
            elevation: 10,
          },
        ]}
      >
        {variant === "transfer" ? (
          <Text
            style={[
              styles.centerIcon,
              {
                fontSize: iconSize,
                lineHeight: iconSize,
                color: isHighlighted ? config.iconColorActive : config.iconColor,
              },
            ]}
          >
            {config.icon}
          </Text>
        ) : (
          <>
            <View style={styles.beatContent}>{children}</View>
            <View
              style={[
                styles.badge,
                {
                  width: badgeSize,
                  height: badgeSize,
                  borderRadius: badgeSize / 2,
                  backgroundColor: config.badgeBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeIcon,
                  { fontSize: badgeFont, lineHeight: badgeFont },
                ]}
              >
                {config.icon}
              </Text>
            </View>
          </>
        )}
      </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.card,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  beatContent: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  badgeIcon: {
    color: colors.textLight,
    fontWeight: "800",
    textAlign: "center",
    includeFontPadding: false,
  },
  centerIcon: {
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
});

export const ChoiceDropSlot = React.memo(ChoiceDropSlotComponent);
