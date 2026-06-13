import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import { Background } from "../components/Background";
import { CardFan } from "../components/CardFan";
import { FriendsDrawer } from "../components/FriendsDrawer";
import { GameConfigDrawer } from "../components/GameConfigDrawer";
import { OnlineJoinDrawer } from "../components/OnlineJoinDrawer";
import { MenuButton } from "../components/MenuButton";
import { GlowTitle, HeroPanel, StaticTitle } from "../components/HomeHero";
import { useUiTheme } from "../theme/UiThemeContext";
import { spacing, typography } from "../theme";
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

export function HomeScreen({ onOpenSettings, onOpenRules }: HomeScreenProps) {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const lay = useGameLayout();
  const insets = useSafeAreaInsets();
  const playerNameHydrated = useGameStore((s) => s.playerNameHydrated);
  const goldBalance = useGameStore((s) => s.goldBalance);
  const creditBalance = useGameStore((s) => s.creditBalance);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [decorReady, setDecorReady] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setDecorReady(true);
      return;
    }
    setDecorReady(false);
    const handle = requestIdleCallback(() => {
      setDecorReady(true);
    });
    return () => cancelIdleCallback(handle);
  }, [reduceMotion]);

  const handleMenu = (action: string) => {
    if (action === "play" || action === "join") {
      if (!playerNameHydrated) return;
    }
    if (action === "play") setDrawerOpen(true);
    if (action === "join") setJoinOpen(true);
    if (action === "friends") setFriendsOpen(true);
    if (action === "settings") onOpenSettings();
    if (action === "rules") onOpenRules();
  };

  const screen = useGameStore((s) => s.screen);
  const active = screen === "home";
  const showAnimatedDecor = decorReady && !reduceMotion && appActive && active;

  return (
    <Background variant="home" deferAmbience={!showAnimatedDecor}>
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
      {friendsOpen && (
        <FriendsDrawer
          visible
          onClose={() => setFriendsOpen(false)}
        />
      )}
    </Background>
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
  fanWrap: {
    height:         150,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   spacing.sm,
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
