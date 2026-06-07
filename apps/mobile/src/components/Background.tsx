import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  makeMutable,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";

export interface BackgroundProps {
  children: React.ReactNode;
  /** `home` — themed app chrome; `game` — themed playing-area color. */
  variant?: "home" | "game";
  /** When true, skip animated sparkles and pulsing rings (plain gradient only). */
  deferAmbience?: boolean;
}

function sr(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const SPARKLE_COUNT = 8;

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

type SparkleMotion = {
  progress: SharedValue<number>;
};

function SparkleDot({
  spec,
  color,
  motion,
}: {
  spec: SparkleSpec;
  color: string;
  motion: SparkleMotion;
}) {
  const aStyle = useAnimatedStyle(() => ({
    opacity: interpolate(motion.progress.value, [0, 0.5, 1], [0.08, 0.75, 0.08]),
    transform: [
      { translateY: interpolate(motion.progress.value, [0, 1], [0, -18]) },
      { scale: interpolate(motion.progress.value, [0, 0.5, 1], [0.6, 1.2, 0.6]) },
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
          backgroundColor: color,
        },
        aStyle,
      ]}
    />
  );
}

function SparkleLayer({ color }: { color: string }) {
  const sparkles = useMemo(() => buildSparkles(SPARKLE_COUNT), []);
  const motion = useMemo(
    () => sparkles.map(() => ({ progress: makeMutable(0) })),
    [sparkles],
  );

  useEffect(() => {
    sparkles.forEach((spec, i) => {
      const { progress } = motion[i]!;
      progress.value = withDelay(
        spec.delay,
        withRepeat(
          withSequence(
            withTiming(1, {
              duration: spec.duration * 0.45,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(0, {
              duration: spec.duration * 0.55,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          -1,
          false,
        ),
      );
    });
  }, [sparkles, motion]);

  return (
    <>
      {sparkles.map((spec, i) => (
        <SparkleDot key={spec.id} spec={spec} color={color} motion={motion[i]!} />
      ))}
    </>
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

function HomeDecorShapes({
  ringFaint,
  ring,
  diamond,
  line,
}: {
  ringFaint: string;
  ring: string;
  diamond: string;
  line: string;
}) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.cornerArc, styles.cornerArcTL, { borderColor: ringFaint }]} />
      <View style={[styles.cornerArc, styles.cornerArcBR, { borderColor: ringFaint }]} />

      <View style={[styles.diamond, { top: height * 0.14, right: width * 0.08, borderColor: diamond }]} />
      <View style={[styles.diamond, styles.diamondSm, { bottom: height * 0.22, left: width * 0.06, borderColor: diamond }]} />
      <View style={[styles.diamond, styles.diamondSm, { top: height * 0.72, right: width * 0.14, borderColor: diamond }]} />

      <View style={[styles.accentLine, { top: "18%", width: width * 0.28, left: width * 0.04, backgroundColor: line }]} />
      <View style={[styles.accentLine, { top: "76%", width: width * 0.22, right: width * 0.06, backgroundColor: line }]} />
    </View>
  );
}

function HomeAmbience({ deferAmbience }: { deferAmbience: boolean }) {
  const ui = useUiTheme();
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <HomeDecorShapes
        ringFaint={ui.panelBorderSoft}
        ring={ui.panelBorder}
        diamond={ui.panelBorderSoft}
        line={ui.panelBorderSoft}
      />

      <LinearGradient
        colors={[ui.accentSoft, "transparent", "transparent"]}
        locations={[0, 0.4, 0.75]}
        style={styles.spotlightTop}
      />

      {!deferAmbience && (
        <>
          <PulsingRing
            size={width * 0.92}
            left={width * 0.04 - width * 0.46}
            top={height * 0.06}
            borderColor={ui.panelBorderSoft}
            borderWidth={1}
            duration={9000}
          />
          <PulsingRing
            size={width * 0.62}
            left={width * 0.72 - width * 0.31}
            top={height * 0.58}
            borderColor={ui.panelBorder}
            borderWidth={1.5}
            duration={7200}
          />
          <SparkleLayer color={ui.accent} />
        </>
      )}
    </View>
  );
}

export function Background({
  children,
  variant = "home",
  deferAmbience = false,
}: BackgroundProps) {
  const tableTheme = useTableTheme();
  const ui = useUiTheme();
  const grad = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    ui.feltEdge,
  ];

  if (variant === "game") {
    if (tableTheme.backgroundGradient) {
      return (
        <LinearGradient
          colors={tableTheme.backgroundGradient}
          style={styles.fill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          {children}
        </LinearGradient>
      );
    }
    return (
      <View style={[styles.fill, { backgroundColor: tableTheme.backgroundColor }]}>
        {children}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={grad.length >= 2 ? grad : [grad[0]!, ui.feltEdge]}
      locations={grad.length >= 4 ? [0, 0.35, 0.72, 1] : undefined}
      style={styles.fill}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <HomeAmbience deferAmbience={deferAmbience} />

      <View style={[styles.vignetteTop, { backgroundColor: ui.activeTint }]} pointerEvents="none" />
      <View style={[styles.vignetteBottom, { backgroundColor: ui.urgentBg }]} pointerEvents="none" />

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
  },
  decorRing: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  cornerArc: {
    position: "absolute",
    width: 120,
    height: 120,
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
  },
  vignetteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "38%",
    pointerEvents: "none",
  },
  vignetteBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "42%",
    pointerEvents: "none",
  },
});
