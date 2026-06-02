import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme";

export interface BackgroundProps {
  children: React.ReactNode;
  /** Richer animated ambience — home screen only. */
  variant?: "default" | "home";
}

function sr(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

interface SparkleSpec {
  id: number;
  leftPct: number;
  topPct: number;
  size: number;
  delay: number;
  duration: number;
}

function buildSparkles(count: number): SparkleSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    leftPct: sr(i * 3) * 100,
    topPct: sr(i * 7) * 100,
    size: 2 + Math.round(sr(i * 11) * 2),
    delay: Math.round(sr(i * 13) * 2400),
    duration: Math.round(sr(i * 17) * 1800) + 2600,
  }));
}

function Sparkle({ spec }: { spec: SparkleSpec }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spec.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: spec.duration * 0.45, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: spec.duration * 0.55, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [progress, spec.delay, spec.duration]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.08, 0.75, 0.08]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -18]) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [0.6, 1.2, 0.6]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sparkle,
        {
          left: `${spec.leftPct}%`,
          top: `${spec.topPct}%`,
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
        },
        aStyle,
      ]}
    />
  );
}

function PulsingRing({
  size,
  left,
  top,
  borderColor,
  borderWidth,
  duration,
}: {
  size: number;
  left: number;
  top: number;
  borderColor: string;
  borderWidth: number;
  duration: number;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [pulse, duration]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.85]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.97, 1.03]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.decorRing,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor,
          left,
          top,
        },
        aStyle,
      ]}
    />
  );
}

function HomeDecorShapes() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Large corner arcs */}
      <View style={[styles.cornerArc, styles.cornerArcTL]} />
      <View style={[styles.cornerArc, styles.cornerArcBR]} />

      {/* Floating rings */}
      <PulsingRing
        size={width * 0.92}
        left={width * 0.04 - width * 0.46}
        top={height * 0.06}
        borderColor={colors.homeDecor.ringFaint}
        borderWidth={1}
        duration={9000}
      />
      <PulsingRing
        size={width * 0.62}
        left={width * 0.72 - width * 0.31}
        top={height * 0.58}
        borderColor={colors.homeDecor.ring}
        borderWidth={1.5}
        duration={7200}
      />

      {/* Diamond accents */}
      <View style={[styles.diamond, { top: height * 0.14, right: width * 0.08 }]} />
      <View style={[styles.diamond, styles.diamondSm, { bottom: height * 0.22, left: width * 0.06 }]} />
      <View style={[styles.diamond, styles.diamondSm, { top: height * 0.72, right: width * 0.14 }]} />

      {/* Horizontal accent lines */}
      <View style={[styles.accentLine, { top: "18%", width: width * 0.28, left: width * 0.04 }]} />
      <View style={[styles.accentLine, { top: "76%", width: width * 0.22, right: width * 0.06 }]} />
    </View>
  );
}

function HomeAmbience() {
  const sparkles = useMemo(() => buildSparkles(18), []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <HomeDecorShapes />

      {/* Soft gold spotlight from above */}
      <LinearGradient
        colors={[colors.homeDecor.spotlight, colors.homeDecor.spotlightFade, "transparent"]}
        locations={[0, 0.4, 0.75]}
        style={styles.spotlightTop}
      />

      {sparkles.map((s) => (
        <Sparkle key={s.id} spec={s} />
      ))}
    </View>
  );
}

export function Background({ children, variant = "default" }: BackgroundProps) {
  const isHome = variant === "home";

  return (
    <LinearGradient
      colors={
        isHome
          ? [colors.homeBg.top, colors.homeBg.mid, colors.homeBg.bottom, colors.homeBg.edge]
          : [colors.feltTop, colors.feltMid, colors.feltBottom]
      }
      locations={isHome ? [0, 0.35, 0.72, 1] : [0, 0.45, 1]}
      style={styles.fill}
    >
      {isHome && <HomeAmbience />}

      <View style={[styles.vignetteTop, isHome && styles.vignetteTopHome]} pointerEvents="none" />
      <View style={[styles.vignetteBottom, isHome && styles.vignetteBottomHome]} pointerEvents="none" />

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spotlightTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  sparkle: {
    position: "absolute",
    backgroundColor: colors.homeDecor.sparkle,
  },
  decorRing: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  cornerArc: {
    position: "absolute",
    width: 120,
    height: 120,
    borderColor: colors.homeDecor.ringFaint,
    backgroundColor: "transparent",
  },
  cornerArcTL: {
    top: -40,
    left: -40,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopLeftRadius: 80,
  },
  cornerArcBR: {
    bottom: -40,
    right: -40,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomRightRadius: 80,
  },
  diamond: {
    position: "absolute",
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: colors.homeDecor.diamond,
    backgroundColor: "transparent",
    transform: [{ rotate: "45deg" }],
  },
  diamondSm: {
    width: 16,
    height: 16,
    opacity: 0.7,
  },
  accentLine: {
    position: "absolute",
    height: 1,
    backgroundColor: colors.homeDecor.line,
  },
  vignetteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "35%",
    backgroundColor: "rgba(6, 26, 18, 0.28)",
    pointerEvents: "none",
  },
  vignetteTopHome: {
    height: "38%",
    backgroundColor: colors.homeDecor.vignetteSoft,
  },
  vignetteBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(6, 26, 18, 0.35)",
    pointerEvents: "none",
  },
  vignetteBottomHome: {
    height: "42%",
    backgroundColor: colors.homeDecor.vignette,
  },
});
