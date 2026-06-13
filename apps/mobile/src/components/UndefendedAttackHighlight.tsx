import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useAppActive } from "../hooks/useAppActive";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { colors, radius } from "../theme";

// Glow halo inset, mirroring ChoiceDropSlot's shadowless pulse approach.
const GLOW = 9;

export interface UndefendedAttackHighlightProps {
  width: number;
  height: number;
  /** Brighter pulse + BEAT hint when it's the local player's turn to beat. */
  strong: boolean;
}

/**
 * Passive, drag-independent marker drawn over an unbeaten attack card so every
 * player can see which cards are still live. A soft red outline breathes for
 * everyone; the local defender-to-act gets a brighter pulse and a BEAT hint.
 *
 * The pulse is carried by an animated-opacity flat layer (no per-frame shadow
 * rasterization) and is gated on app foreground + reduce-motion, matching
 * ChoiceDropSlot.
 */
function UndefendedAttackHighlightComponent({
  width,
  height,
  strong,
}: UndefendedAttackHighlightProps) {
  const appActive = useAppActive();
  const reduceMotion = useReduceMotion();
  const glowOp = useSharedValue(strong ? 0.5 : 0.2);

  useEffect(() => {
    cancelAnimation(glowOp);

    if (reduceMotion || !appActive) {
      glowOp.value = withTiming(strong ? 0.85 : 0.3, { duration: 160 });
      return;
    }

    const [hi, lo, dur] = strong ? [1.0, 0.5, 360] : [0.4, 0.14, 1000];
    glowOp.value = withRepeat(
      withSequence(
        withTiming(hi, { duration: dur }),
        withTiming(lo, { duration: dur }),
      ),
      -1,
      false,
    );
  }, [strong, appActive, reduceMotion, glowOp]);

  const aGlow = useAnimatedStyle(() => ({ opacity: glowOp.value }));

  const borderColor = strong ? colors.danger : "rgba(229, 72, 77, 0.55)";
  const glowColor = colors.danger;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      {/* Shadowless glow halo just outside the card edges. */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: width + GLOW * 2,
            height: height + GLOW * 2,
            borderRadius: radius.card + GLOW,
            borderColor: glowColor,
            backgroundColor: "rgba(229, 72, 77, 0.10)",
          },
          aGlow,
        ]}
      />
      {/* Crisp outline hugging the card. */}
      <View
        style={[
          styles.ring,
          {
            width,
            height,
            borderColor,
            borderWidth: strong ? 2.5 : 2,
          },
        ]}
      />
      {strong && (
        <View style={styles.labelWrap}>
          <Text style={styles.labelText}>BEAT</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    borderWidth: 2,
  },
  ring: {
    position: "absolute",
    borderRadius: radius.card,
  },
  labelWrap: {
    position: "absolute",
    bottom: -20,
    left: -18,
    right: -18,
    alignItems: "center",
  },
  labelText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#F2787C",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export const UndefendedAttackHighlight = React.memo(
  UndefendedAttackHighlightComponent,
);
