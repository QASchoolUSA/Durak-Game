import React, { useEffect, useState } from "react";
import { InteractionManager, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
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
import { radius, spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { useAppActive } from "../hooks/useAppActive";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { EconomyBar } from "../components/EconomyBar";
import { useGameStore } from "../game/store";
import { convexEnabled } from "../game/convexClient";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface HomeScreenProps {
  onOpenSettings: () => void;
  onOpenRules:    () => void;
}

type MenuItem = {
  label: string;
  variant: "primary" | "secondary" | "ghost";
  icon: string;
  action: string;
};

const BASE_MENU_ITEMS: MenuItem[] = [
  { label: "PLAY",        variant: "primary",   icon: "▶", action: "play"     },
  { label: "JOIN GAME",   variant: "secondary", icon: "⎘", action: "join"     },
  ...(convexEnabled
    ? [{ label: "FRIENDS", variant: "secondary" as const, icon: "♣", action: "friends" }]
    : []),
  { label: "SETTINGS",    variant: "secondary", icon: "⚙", action: "settings" },
  { label: "HOW TO PLAY", variant: "ghost",     icon: "?", action: "rules"    },
];

/** Reactive badge for pending friend requests + game invites. */
function FriendsMenuButton({ onPress }: { onPress: () => void }) {
  const { isAuthenticated } = useConvexAuth();
  const requests = useQuery(
    api.friends.incomingRequests,
    isAuthenticated ? {} : "skip",
  );
  const invites = useQuery(
    api.invites.incomingInvites,
    isAuthenticated ? {} : "skip",
  );
  const count = (requests?.length ?? 0) + (invites?.length ?? 0);
  return (
    <MenuButton
      label="FRIENDS"
      variant="secondary"
      icon="♣"
      onPress={onPress}
      badgeCount={count}
    />
  );
}

const TITLE_LETTERS = ["D", "U", "R", "A", "K"] as const;

export function HomeScreen({ onOpenSettings, onOpenRules }: HomeScreenProps) {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const lay = useGameLayout();
  const insets = useSafeAreaInsets();
  const playerNameHydrated = useGameStore((s) => s.playerNameHydrated);
  const openFriends = useGameStore((s) => s.openFriends);
  const goldBalance = useGameStore((s) => s.goldBalance);
  const creditBalance = useGameStore((s) => s.creditBalance);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [decorReady, setDecorReady] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setDecorReady(true);
      return;
    }
    setDecorReady(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setDecorReady(true);
    });
    return () => task.cancel();
  }, [reduceMotion]);

  const handleMenu = (action: string) => {
    if (action === "play" || action === "join") {
      if (!playerNameHydrated) return;
    }
    if (action === "play") setDrawerOpen(true);
    if (action === "join") setJoinOpen(true);
    if (action === "friends") openFriends();
    if (action === "settings") onOpenSettings();
    if (action === "rules") onOpenRules();
  };

  const showAnimatedDecor = decorReady && !reduceMotion && appActive;

  return (
    <Background variant="home" deferAmbience={!decorReady}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={[styles.topBar, { paddingHorizontal: lay.hPad }]}>
          <EconomyBar
            variant="home"
            creditBalance={creditBalance}
            goldBalance={goldBalance}
          />
        </View>
        <View
          style={[
            styles.content,
            {
              paddingHorizontal: lay.hPad,
              paddingBottom: Math.max(insets.bottom, lay.s(spacing.md)),
            },
          ]}
        >
          <HeroPanel maxWidth={lay.maxContent}>
            <View style={[styles.fanWrap, { height: lay.s(150), marginBottom: lay.s(spacing.sm) }]}>
              {decorReady ? (
                <CardFan animate={showAnimatedDecor} />
              ) : null}
            </View>
            {showAnimatedDecor ? (
              <GlowTitle />
            ) : (
              <StaticTitle />
            )}
          </HeroPanel>

          <Animated.View
            entering={
              showAnimatedDecor
                ? FadeIn.duration(250).easing(Easing.out(Easing.cubic))
                : undefined
            }
            style={[styles.menu, { maxWidth: lay.maxContent }]}
          >
            {BASE_MENU_ITEMS.map((item) =>
              item.action === "friends" ? (
                <FriendsMenuButton key={item.label} onPress={() => handleMenu("friends")} />
              ) : (
                <MenuButton
                  key={item.label}
                  label={item.label}
                  variant={item.variant}
                  onPress={() => handleMenu(item.action)}
                  icon={item.icon}
                />
              ),
            )}
          </Animated.View>

          <Text style={[styles.version, { color: ui.textFaint }]}>
            v1.0 · Durak Card Game
          </Text>
        </View>
      </SafeAreaView>

      {drawerOpen && (
        <GameConfigDrawer
          visible
          onClose={() => setDrawerOpen(false)}
        />
      )}
      {joinOpen && (
        <OnlineJoinDrawer
          visible
          onClose={() => setJoinOpen(false)}
        />
      )}
    </Background>
  );
}

function HeroPanel({
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

function StaticTitle() {
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

function GlowTitle() {
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
  safe: { flex: 1 },
  topBar: {
    alignItems: "flex-end",
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
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
    transform:       [{ rotate: "45deg" }],
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
