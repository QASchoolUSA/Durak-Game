import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, spacing } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";

const TITLE_LETTERS = ["D", "U", "R", "A", "K"] as const;

/** Themed gradient panel with the double ring backdrop — shared by Home and Welcome. */
export function HeroPanel({
  children,
  maxWidth,
}: {
  children: React.ReactNode;
  maxWidth: number;
}) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const panelGrad = tableTheme.backgroundGradient ?? [
    ui.panelBg,
    ui.feltEdge,
    ui.feltEdge,
  ];

  return (
    <View style={[styles.heroPanelWrap, { maxWidth, width: "100%" }]}>
      <View
        style={[styles.heroRingOuter, { borderColor: ui.panelBorderSoft }]}
        pointerEvents="none"
      />
      <View
        style={[styles.heroRingInner, { borderColor: ui.panelBorderSoft }]}
        pointerEvents="none"
      />

      <LinearGradient
        colors={
          panelGrad.length >= 3
            ? panelGrad
            : [ui.panelBg, ui.feltEdge, ui.feltEdge]
        }
        locations={[0, 0.55, 1]}
        style={[styles.heroPanel, { borderColor: ui.panelBorder }]}
      >
        <View
          style={[styles.heroPanelBorder, { borderColor: ui.panelBorderSoft }]}
          pointerEvents="none"
        />
        {children}
      </LinearGradient>
    </View>
  );
}

export function StaticTitle() {
  const ui = useUiTheme();
  const { s } = useGameLayout();
  const titleSize = s(62);

  return (
    <View style={styles.titleBlock}>
      <Text
        style={[
          styles.heroTitle,
          { color: ui.accent, textShadowColor: ui.accent, fontSize: titleSize },
        ]}
      >
        DURAK
      </Text>
      <View style={styles.titleOrnament}>
        <View style={[styles.ornamentLine, { width: 44, backgroundColor: ui.accent }]} />
        <View
          style={[
            styles.ornamentDiamond,
            { backgroundColor: ui.accent, borderColor: ui.accentMuted },
          ]}
        />
        <View style={[styles.ornamentLine, { width: 44, backgroundColor: ui.accent }]} />
      </View>
    </View>
  );
}

function TitleLetter({
  char,
  glow,
  wave,
  accent,
  accentMuted,
  titleSize,
}: {
  char: string;
  glow: SharedValue<number>;
  wave: SharedValue<number>;
  accent: string;
  accentMuted: string;
  titleSize: number;
}) {
  const letterStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(wave.value, [0, 1], [0, -5]) },
      { scale: interpolate(wave.value, [0, 1], [1, 1.04]) },
    ],
    opacity: interpolate(glow.value, [0, 1], [0.88, 1]),
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.35, 0.65]),
    transform: [{ translateY: interpolate(wave.value, [0, 1], [2, 4]) }],
  }));

  return (
    <View style={styles.letterWrap}>
      <Animated.Text
        style={[
          styles.heroTitleShadow,
          { color: accentMuted, fontSize: titleSize },
          shadowStyle,
        ]}
      >
        {char}
      </Animated.Text>
      <Animated.Text
        style={[
          styles.heroTitle,
          { color: accent, textShadowColor: accent, fontSize: titleSize },
          letterStyle,
        ]}
      >
        {char}
      </Animated.Text>
    </View>
  );
}

export function GlowTitle() {
  const ui = useUiTheme();
  const { s } = useGameLayout();
  const titleSize = s(62);
  const glow = useSharedValue(0);
  const ornament = useSharedValue(0);
  const wave = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    ornament.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    wave.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [glow, ornament, wave]);

  const lineStyle = useAnimatedStyle(() => ({
    width: interpolate(ornament.value, [0, 1], [32, 56]),
    opacity: interpolate(ornament.value, [0, 1], [0.45, 1]),
  }));

  const diamondStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: "45deg" },
      { scale: interpolate(ornament.value, [0, 1], [0.85, 1.1]) },
    ],
    opacity: interpolate(ornament.value, [0, 1], [0.6, 1]),
  }));

  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleRow}>
        {TITLE_LETTERS.map((char) => (
          <TitleLetter
            key={char}
            char={char}
            glow={glow}
            wave={wave}
            accent={ui.accent}
            accentMuted={ui.accentMuted}
            titleSize={titleSize}
          />
        ))}
      </View>
      <View style={styles.titleOrnament}>
        <Animated.View
          style={[styles.ornamentLine, { backgroundColor: ui.accent }, lineStyle]}
        />
        <Animated.View
          style={[
            styles.ornamentDiamond,
            {
              backgroundColor: ui.accent,
              borderColor: ui.accentMuted,
            },
            diamondStyle,
          ]}
        />
        <Animated.View
          style={[styles.ornamentLine, { backgroundColor: ui.accent }, lineStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroPanelWrap: {
    alignItems:   "center",
    marginBottom: spacing.xl,
    position:     "relative",
  },
  heroRingOuter: {
    position:        "absolute",
    top:             -12,
    width:           "88%",
    aspectRatio:     1,
    maxWidth:        340,
    borderRadius:    999,
    borderWidth:     1,
    backgroundColor: "transparent",
  },
  heroRingInner: {
    position:        "absolute",
    top:             8,
    width:           "72%",
    aspectRatio:     1,
    maxWidth:        280,
    borderRadius:    999,
    borderWidth:     1,
    backgroundColor: "transparent",
  },
  heroPanel: {
    width:          "100%",
    borderRadius:   radius.panel,
    borderWidth:    1,
    paddingTop:     spacing.lg,
    paddingBottom:  spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems:     "center",
    overflow:       "hidden",
  },
  heroPanelBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.panel,
    borderWidth:  1,
    margin:       6,
  },
  titleBlock: {
    alignItems: "center",
    marginTop: spacing.xs,
  },
  titleRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
  },
  letterWrap: {
    position: "relative",
    marginHorizontal: 2,
  },
  heroTitle: {
    fontSize:        62,
    fontWeight:      "900",
    letterSpacing:   2,
    textShadowOffset:{ width: 0, height: 0 },
    textShadowRadius: 20,
  },
  heroTitleShadow: {
    position:        "absolute",
    top:             0,
    left:            0,
    fontSize:        62,
    fontWeight:      "900",
    letterSpacing:   2,
  },
  titleOrnament: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            spacing.sm,
    marginTop:      spacing.md,
  },
  ornamentLine: {
    height:          1.5,
    borderRadius:    1,
  },
  ornamentDiamond: {
    width:           7,
    height:          7,
    borderWidth:     1,
    transform:       [{ rotate: "45deg" }],
  },
});
