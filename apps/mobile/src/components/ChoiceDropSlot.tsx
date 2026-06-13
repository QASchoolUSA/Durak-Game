import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAppActive } from "../hooks/useAppActive";
import { useSharedBool } from "../hooks/useSharedBool";
import { colors, radius } from "../theme";

export type ChoiceDropVariant = "beat" | "transfer";

// Single shadowless glow halo around the slot (was two soft-shadow rings).
const GLOW = 10;

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
  /** UI-thread drag flag — avoids parent re-render on drag start. */
  availableSV?: SharedValue<boolean>;
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
  availableSV,
  disabled = false,
  children,
}: ChoiceDropSlotProps) {
  const cfg = CFG[variant];
  const dragAvailable = useSharedBool(availableSV, available);
  const appActive = useAppActive();

  // Shared animation values
  const slotOpacity = useSharedValue(1);
  const scale       = useSharedValue(1);
  const glowOp      = useSharedValue(0);
  const labelOp     = useSharedValue(0);
  const labelY      = useSharedValue(8);

  const isActive = active && !disabled;
  const isAvail = dragAvailable && !disabled && !isActive && !dimmed;

  // ── Slot-level opacity (dim/disable fade) ─────────────────────────────────
  useEffect(() => {
    slotOpacity.value = withTiming(
      disabled ? 0.28 : dimmed ? 0.12 : 1,
      { duration: 200 },
    );
  }, [disabled, dimmed, slotOpacity]);

  // ── Glow + scale + label animations ───────────────────────────────────────
  // The glow halo is shadowless (animated opacity on a flat layer) so the pulse
  // runs cheaply on the UI thread — no per-frame offscreen shadow rasterization.
  // Infinite loops are gated on `appActive` so a backgrounded slot stops pulsing.
  useEffect(() => {
    cancelAnimation(glowOp);

    if (isActive) {
      // Satisfying pop on enter
      scale.value = withSequence(
        withSpring(1.11, SPRING_POP),
        withSpring(1.07, SPRING_SETTLE),
      );

      // Bright pulse (flash → repeat), only while the app is foregrounded.
      glowOp.value = appActive
        ? withSequence(
            withTiming(1.0, { duration: 60 }),
            withRepeat(
              withSequence(
                withTiming(1.0, { duration: 330 }),
                withTiming(0.5, { duration: 330 }),
              ),
              -1,
              false,
            ),
          )
        : withTiming(0.9, { duration: 120 });

      // Label slides in brightly
      labelOp.value = withTiming(1.0, { duration: 140 });
      labelY.value  = withSpring(0, { damping: 14, stiffness: 300 });

    } else if (isAvail) {
      scale.value = withTiming(1.0, { duration: 200 });

      // Slow, calm breathing — "I'm here"
      glowOp.value = appActive
        ? withRepeat(
            withSequence(
              withTiming(0.5, { duration: 950 }),
              withTiming(0.16, { duration: 950 }),
            ),
            -1,
            false,
          )
        : withTiming(0.32, { duration: 220 });

      // Label fades in softly
      labelOp.value = withTiming(0.70, { duration: 260 });
      labelY.value  = withTiming(0, { duration: 220 });

    } else {
      scale.value = withTiming(1.0, { duration: 150 });

      glowOp.value = withTiming(0, { duration: 220 });
      labelOp.value = withTiming(0, { duration: 160 });
      labelY.value  = withTiming(8, { duration: 160 });
    }
  }, [isActive, isAvail, appActive]);

  // ── Animated styles ────────────────────────────────────────────────────────
  const aSlot  = useAnimatedStyle(() => ({ opacity: slotOpacity.value }));
  const aScale = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const aGlow  = useAnimatedStyle(() => ({ opacity: glowOp.value }));
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

  return (
    <Animated.View style={[{ width, height }, aSlot]}>

      {/* ── Glow halo (single, shadowless) ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            top: -GLOW, left: -GLOW, right: -GLOW, bottom: -GLOW,
            borderRadius: radius.card + GLOW,
            borderColor: cfg.glow,
            backgroundColor: cfg.innerFill,
          },
          aGlow,
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
                  color: isActive ? CFG.transfer.iconBright : CFG.transfer.iconDim,
                },
              ]}
            >
              {CFG.transfer.icon}
            </Text>
          ) : (
            <View style={styles.beatContent}>{children}</View>
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
    // Static (non-animated) shadow — kept modest so it stays cheap; the pulse is
    // carried by the shadowless glow halo, not by animating this shadow.
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  glow: {
    position: "absolute",
    borderWidth: 2,
  },
  beatContent: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
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
