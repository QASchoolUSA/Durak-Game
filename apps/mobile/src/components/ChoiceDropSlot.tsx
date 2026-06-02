import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../theme";

export type ChoiceDropVariant = "beat" | "transfer";

// Ring layers: inner (tight bright halo) + outer (wide soft bloom)
const INNER = 6;
const OUTER = 18;

const SPRING_POP = { damping: 11, stiffness: 380, mass: 0.55 };
const SPRING_SETTLE = { damping: 20, stiffness: 220, mass: 0.7 };

const CFG = {
  beat: {
    label: "BEAT",
    glow: colors.success,
    border: colors.success,
    borderAvail: "rgba(70, 167, 88, 0.60)",
    innerFill: "rgba(70, 167, 88, 0.22)",
    outerFill: "rgba(70, 167, 88, 0.09)",
    fillAvail: "rgba(70, 167, 88, 0.08)",
    fillActive: "rgba(70, 167, 88, 0.20)",
    labelColor: "#72D084",
    icon: "✓",
    badge: colors.success,
    iconDim: colors.goldDim,
    iconBright: colors.gold,
  },
  transfer: {
    label: "TRANSFER",
    glow: colors.gold,
    border: colors.gold,
    borderAvail: "rgba(231, 192, 103, 0.55)",
    innerFill: "rgba(231, 192, 103, 0.20)",
    outerFill: "rgba(231, 192, 103, 0.08)",
    fillAvail: "rgba(231, 192, 103, 0.07)",
    fillActive: "rgba(12, 45, 34, 0.82)",
    labelColor: "#EDD07A",
    icon: "↪",
    badge: colors.gold,
    iconDim: colors.goldDim,
    iconBright: colors.gold,
  },
} as const;

export interface ChoiceDropSlotProps {
  variant: ChoiceDropVariant;
  width: number;
  height: number;
  active: boolean;
  dimmed: boolean;
  /** Drag is in progress — show slot as a reachable landing zone. */
  available?: boolean;
  /** Slot cannot receive the card (e.g. transfer not legal this turn). */
  disabled?: boolean;
  children?: React.ReactNode;
}

function ChoiceDropSlotComponent({
  variant,
  width,
  height,
  active,
  dimmed,
  available = false,
  disabled = false,
  children,
}: ChoiceDropSlotProps) {
  const cfg = CFG[variant];

  // Shared animation values
  const slotOpacity = useSharedValue(1);
  const scale       = useSharedValue(1);
  const innerOp     = useSharedValue(0);
  const outerOp     = useSharedValue(0);
  const labelOp     = useSharedValue(0);
  const labelY      = useSharedValue(8);

  const isActive = active && !disabled;
  const isAvail  = available && !disabled && !isActive && !dimmed;

  // ── Slot-level opacity (dim/disable fade) ─────────────────────────────────
  useEffect(() => {
    slotOpacity.value = withTiming(
      disabled ? 0.28 : dimmed ? 0.12 : 1,
      { duration: 200 },
    );
  }, [disabled, dimmed, slotOpacity]);

  // ── Ring + scale + label animations ───────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      // Satisfying pop on enter
      scale.value = withSequence(
        withSpring(1.11, SPRING_POP),
        withSpring(1.07, SPRING_SETTLE),
      );

      // Inner ring: flash → pulse
      cancelAnimation(innerOp);
      innerOp.value = withSequence(
        withTiming(1.0, { duration: 60 }),
        withRepeat(
          withSequence(
            withTiming(1.0, { duration: 330 }),
            withTiming(0.42, { duration: 330 }),
          ),
          -1,
          false,
        ),
      );

      // Outer bloom: slower, softer pulse
      cancelAnimation(outerOp);
      outerOp.value = withRepeat(
        withSequence(
          withTiming(0.60, { duration: 400 }),
          withTiming(0.15, { duration: 400 }),
        ),
        -1,
        false,
      );

      // Label slides in brightly
      labelOp.value = withTiming(1.0, { duration: 140 });
      labelY.value  = withSpring(0, { damping: 14, stiffness: 300 });

    } else if (isAvail) {
      scale.value = withTiming(1.0, { duration: 200 });

      // Slow, calm breathing — "I'm here"
      cancelAnimation(innerOp);
      innerOp.value = withRepeat(
        withSequence(
          withTiming(0.32, { duration: 950 }),
          withTiming(0.08, { duration: 950 }),
        ),
        -1,
        false,
      );

      cancelAnimation(outerOp);
      outerOp.value = withRepeat(
        withSequence(
          withTiming(0.18, { duration: 950 }),
          withTiming(0.04, { duration: 950 }),
        ),
        -1,
        false,
      );

      // Label fades in softly
      labelOp.value = withTiming(0.70, { duration: 260 });
      labelY.value  = withTiming(0, { duration: 220 });

    } else {
      scale.value = withTiming(1.0, { duration: 150 });

      cancelAnimation(innerOp);
      cancelAnimation(outerOp);
      innerOp.value = withTiming(0, { duration: 220 });
      outerOp.value = withTiming(0, { duration: 220 });
      labelOp.value = withTiming(0, { duration: 160 });
      labelY.value  = withTiming(8, { duration: 160 });
    }
  }, [isActive, isAvail]);

  // ── Animated styles ────────────────────────────────────────────────────────
  const aSlot  = useAnimatedStyle(() => ({ opacity: slotOpacity.value }));
  const aScale = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const aInner = useAnimatedStyle(() => ({ opacity: innerOp.value }));
  const aOuter = useAnimatedStyle(() => ({ opacity: outerOp.value }));
  const aLabelOpacity = useAnimatedStyle(() => ({ opacity: labelOp.value }));
  const aLabelShift = useAnimatedStyle(() => ({
    transform: [{ translateY: labelY.value }],
  }));

  // ── Derived visual state ───────────────────────────────────────────────────
  const borderColor = isActive
    ? cfg.border
    : isAvail
      ? cfg.borderAvail
      : "rgba(180, 195, 185, 0.14)";

  const bgColor = isActive ? cfg.fillActive : isAvail ? cfg.fillAvail : "transparent";

  const iconSize  = Math.round(width * 0.38);
  const badgeSize = Math.round(width * 0.28);
  const badgeFont = Math.round(badgeSize * 0.55);

  return (
    <Animated.View style={[{ width, height }, aSlot]}>

      {/* ── Outer bloom (wide, soft) ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            top: -OUTER, left: -OUTER, right: -OUTER, bottom: -OUTER,
            borderRadius: radius.card + OUTER,
            borderColor: cfg.glow,
            backgroundColor: cfg.outerFill,
            shadowColor: cfg.glow,
            shadowRadius: 22,
          },
          aOuter,
        ]}
      />

      {/* ── Inner halo (tight, bright) ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            top: -INNER, left: -INNER, right: -INNER, bottom: -INNER,
            borderRadius: radius.card + INNER,
            borderColor: cfg.glow,
            backgroundColor: cfg.innerFill,
            shadowColor: cfg.glow,
            shadowRadius: 10,
          },
          aInner,
        ]}
      />

      {/* ── Slot frame ── */}
      <Animated.View style={[{ width, height }, aScale]}>
        <View
          style={[
            styles.frame,
            { width, height, borderColor, backgroundColor: bgColor },
            isActive && styles.frameActive,
            isActive && { shadowColor: cfg.glow },
          ]}
        >
          {variant === "transfer" ? (
            <Text
              style={[
                styles.centerIcon,
                {
                  fontSize: iconSize,
                  lineHeight: iconSize,
                  color: isActive ? cfg.iconBright : cfg.iconDim,
                },
              ]}
            >
              {cfg.icon}
            </Text>
          ) : (
            <>
              <View style={styles.beatContent}>{children}</View>
              <View
                style={[
                  styles.badge,
                  { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2, backgroundColor: cfg.badge },
                ]}
              >
                <Text style={[styles.badgeIcon, { fontSize: badgeFont, lineHeight: badgeFont }]}>
                  {cfg.icon}
                </Text>
              </View>
            </>
          )}
        </View>
      </Animated.View>

      {/* ── Action label — slides up from below ── */}
      <Animated.View pointerEvents="none" style={[styles.labelWrap, aLabelOpacity]}>
        <Animated.View style={aLabelShift}>
          <Text style={[styles.labelText, { color: cfg.labelColor }]}>
            {cfg.label}
          </Text>
        </Animated.View>
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
  frameActive: {
    borderWidth: 3,
    shadowOpacity: 0.88,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
    shadowOpacity: 0.82,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
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
    shadowOpacity: 0.30,
    shadowRadius: 4,
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
  labelWrap: {
    position: "absolute",
    bottom: -22,
    left: -18,
    right: -18,
    alignItems: "center",
  },
  labelText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export const ChoiceDropSlot = React.memo(ChoiceDropSlotComponent);
