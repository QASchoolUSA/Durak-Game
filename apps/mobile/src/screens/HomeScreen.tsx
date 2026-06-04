import React, { useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Background } from "../components/Background";
import { CardFan } from "../components/CardFan";
import { GameConfigDrawer } from "../components/GameConfigDrawer";
import { OnlineJoinDrawer } from "../components/OnlineJoinDrawer";
import { MenuButton } from "../components/MenuButton";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { layoutFor, radius, spacing, typography } from "../theme";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useGameStore } from "../game/store";

export interface HomeScreenProps {
  onOpenSettings: () => void;
  onOpenRules:    () => void;
}

const MENU_ITEMS = [
  { label: "PLAY",        variant: "primary"   as const, icon: "▶", action: "play"     },
  { label: "JOIN GAME",   variant: "secondary" as const, icon: "⎘", action: "join"     },
  { label: "SETTINGS",    variant: "secondary" as const, icon: "⚙", action: "settings" },
  { label: "HOW TO PLAY", variant: "ghost"     as const, icon: "?", action: "rules"    },
];

export function HomeScreen({ onOpenSettings, onOpenRules }: HomeScreenProps) {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();
  const { width }  = useWindowDimensions();
  const lay        = layoutFor(width);
  const hasSavedPlayerName = useGameStore((s) => s.hasSavedPlayerName);
  const playerNameHydrated = useGameStore((s) => s.playerNameHydrated);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const handleMenu = (action: string) => {
    if (action === "play" || action === "join") {
      if (!playerNameHydrated || !hasSavedPlayerName) return;
    }
    if (action === "play") setDrawerOpen(true);
    if (action === "join") setJoinOpen(true);
    if (action === "settings") onOpenSettings();
    if (action === "rules") onOpenRules();
  };

  return (
    <Background variant="home">
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { paddingHorizontal: lay.hPad }]}>
          <HeroPanel maxWidth={lay.maxContent} reduceMotion={reduceMotion}>
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(700)}
              style={styles.fanWrap}
            >
              <CardFan />
            </Animated.View>
            <GlowTitle reduceMotion={reduceMotion} />
          </HeroPanel>

          <View style={[styles.menu, { maxWidth: lay.maxContent }]}>
            {MENU_ITEMS.map((item, i) => (
              <Animated.View
                key={item.label}
                entering={
                  reduceMotion
                    ? undefined
                    : FadeInDown.delay(280 + i * 120).duration(480).easing(Easing.out(Easing.cubic))
                }
              >
                <MenuButton
                  label={item.label}
                  variant={item.variant}
                  onPress={() => handleMenu(item.action)}
                  icon={item.icon}
                />
              </Animated.View>
            ))}
          </View>

          <Animated.Text
            entering={reduceMotion ? undefined : FadeInUp.delay(720).duration(500)}
            style={[styles.version, { color: ui.textFaint }]}
          >
            v1.0 · Durak Card Game
          </Animated.Text>
        </View>
      </SafeAreaView>

      <GameConfigDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <OnlineJoinDrawer
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
      />
    </Background>
  );
}

function HeroPanel({
  children,
  maxWidth,
  reduceMotion,
}: {
  children: React.ReactNode;
  maxWidth: number;
  reduceMotion: boolean;
}) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const panelGrad = tableTheme.backgroundGradient ?? [
    ui.panelBg,
    ui.feltEdge,
    ui.feltEdge,
  ];

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(600)}
      style={[styles.heroPanelWrap, { maxWidth, width: "100%" }]}
    >
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
    </Animated.View>
  );
}

const TITLE_LETTERS = ["D", "U", "R", "A", "K"] as const;

function TitleLetter({
  char,
  index,
  glow,
  accent,
  accentMuted,
  reduceMotion,
}: {
  char: string;
  index: number;
  glow: SharedValue<number>;
  accent: string;
  accentMuted: string;
  reduceMotion: boolean;
}) {
  const wave = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    wave.value = withDelay(
      index * 140,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [wave, index, reduceMotion]);

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
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.delay(index * 70).duration(420).easing(Easing.out(Easing.back(1.4)))
      }
      style={styles.letterWrap}
    >
      <Animated.Text
        style={[styles.heroTitleShadow, { color: accentMuted }, shadowStyle]}
      >
        {char}
      </Animated.Text>
      <Animated.Text
        style={[
          styles.heroTitle,
          { color: accent, textShadowColor: accent },
          letterStyle,
        ]}
      >
        {char}
      </Animated.Text>
    </Animated.View>
  );
}

function GlowTitle({ reduceMotion }: { reduceMotion: boolean }) {
  const ui = useUiTheme();
  const glow = useSharedValue(reduceMotion ? 1 : 0);
  const ornament = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
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
  }, [glow, ornament, reduceMotion]);

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
        {TITLE_LETTERS.map((char, i) => (
          <TitleLetter
            key={char}
            char={char}
            index={i}
            glow={glow}
            accent={ui.accent}
            accentMuted={ui.accentMuted}
            reduceMotion={reduceMotion}
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
  safe:    { flex: 1 },
  content: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
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
  fanWrap: {
    height:         150,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   spacing.sm,
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
  },
  menu: {
    width:      "100%",
    alignSelf:  "center",
    gap:        spacing.sm,
  },
  version: {
    ...typography.caption,
    marginTop: spacing.xl,
  },
});
