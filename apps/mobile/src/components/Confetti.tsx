import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { MENU_CARD_THEME } from "../theme/cardThemes";
import { colors } from "../theme";

// Deterministic "random" from seed — no Math.random() in hot paths
function sr(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const N = 28;

interface Particle {
  id: number;
  color: string;
  size: number;
  isCircle: boolean;
  startX: number;
  velX: number;
  velY: number;
  delay: number;
  duration: number;
}

function buildParticles(confettiColors: string[]): Particle[] {
  return Array.from({ length: N }, (_, i) => ({
    id: i,
    color: confettiColors[i % confettiColors.length]!,
    size: 5 + Math.round(sr(i * 7) * 5),
    isCircle: sr(i * 13) > 0.5,
    startX: (sr(i * 3) - 0.5) * 80,
    velX: (sr(i * 5) - 0.5) * 340,
    velY: -(sr(i * 11) * 360 + 120),
    delay: Math.round(sr(i * 17) * 220),
    duration: Math.round(sr(i * 19) * 600) + 1100,
  }));
}

function Particle({ p }: { p: Particle }) {
  const tx = useSharedValue(p.startX);
  const ty = useSharedValue(0);
  const op = useSharedValue(1);

  useEffect(() => {
    tx.value = withDelay(p.delay, withTiming(p.startX + p.velX, { duration: p.duration }));
    ty.value = withDelay(p.delay, withTiming(p.velY + 500, { duration: p.duration }));
    op.value = withDelay(p.delay + p.duration * 0.55, withTiming(0, { duration: p.duration * 0.45 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    opacity: op.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        aStyle,
        {
          width: p.size,
          height: p.size,
          backgroundColor: p.color,
          borderRadius: p.isCircle ? p.size / 2 : 2,
        },
      ]}
    />
  );
}

export function Confetti() {
  const theme = MENU_CARD_THEME;
  const particles = useMemo(
    () =>
      buildParticles([
        colors.gold,
        colors.goldBright,
        colors.success,
        theme.face,
        theme.suitRed,
        "#7BCFB8",
        "#F2A65A",
      ]),
    [theme.face, theme.suitRed],
  );

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} p={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 80,
  },
  particle: {
    position: "absolute",
  },
});
