import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Background } from "../components/Background";
import { CardFan } from "../components/CardFan";
import { FriendsDrawer } from "../components/FriendsDrawer";
import { GameConfigDrawer } from "../components/GameConfigDrawer";
import { OnlineJoinDrawer } from "../components/OnlineJoinDrawer";
import { MenuButton } from "../components/MenuButton";
import { HeroPanel, StaticTitle } from "../components/HomeHero";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { useAppActive } from "../hooks/useAppActive";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { EconomyBar } from "../components/EconomyBar";
import { useGameStore } from "../game/store";
import { useAccountKind } from "../game/useAccountKind";
import { convexEnabled } from "../game/convexClient";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isExpoGo } from "../utils/isExpoGo";

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

function buildMenuItems(showFriends: boolean, t: (key: string) => string): MenuItem[] {
  return [
    { label: t("home.play"),        variant: "primary",   icon: "▶", action: "play"     },
    { label: t("home.joinGame"),   variant: "secondary", icon: "⎘", action: "join"     },
    ...(showFriends
      ? [{ label: t("home.friends"), variant: "secondary" as const, icon: "♣", action: "friends" }]
      : []),
    { label: t("home.settings"),    variant: "secondary", icon: "⚙", action: "settings" },
    { label: t("home.howToPlay"), variant: "secondary",     icon: "?", action: "rules"    },
  ];
}

/** Reactive badge for pending friend requests + game invites. */
function FriendsMenuButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
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
      label={t("home.friends")}
      variant="secondary"
      icon="♣"
      onPress={onPress}
      badgeCount={count}
    />
  );
}

function IdentityChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const ui = useUiTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.identityChip,
        { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
      ]}
    >
      <Text style={[styles.identityChipText, { color: ui.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function HomeScreen({ onOpenSettings, onOpenRules }: HomeScreenProps) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const lay = useGameLayout();
  const insets = useSafeAreaInsets();
  const { isGuest, handle, isLoading: accountLoading } = useAccountKind();
  const playerNameHydrated = useGameStore((s) => s.playerNameHydrated);
  const goldBalance = useGameStore((s) => s.goldBalance);
  const creditBalance = useGameStore((s) => s.creditBalance);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [decorReady, setDecorReady] = useState(reduceMotion);

  // Wait for account kind so FRIENDS does not flash for guests.
  const showFriends = convexEnabled && !accountLoading && !isGuest;
  const menuItems = buildMenuItems(showFriends, t);
  const identityLabel =
    convexEnabled && !accountLoading
      ? isGuest
        ? t("common.guest")
        : handle
          ? `@${handle}`
          : t("common.account")
      : null;

  useEffect(() => {
    if (reduceMotion) {
      setDecorReady(true);
      return;
    }
    setDecorReady(false);
    const handleId = requestIdleCallback(() => {
      setDecorReady(true);
    });
    return () => cancelIdleCallback(handleId);
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
  const showAnimatedDecor =
    !isExpoGo && decorReady && !reduceMotion && appActive && active;

  return (
    <Background variant="home" deferAmbience={!showAnimatedDecor}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={[styles.topBar, { paddingHorizontal: lay.hPad }]}>
          {identityLabel ? (
            <IdentityChip label={identityLabel} onPress={onOpenSettings} />
          ) : (
            <View />
          )}
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
            <StaticTitle />
          </HeroPanel>

          <View style={[styles.menu, { maxWidth: lay.maxContent }]}>
            {menuItems.map((item) =>
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
          </View>

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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  identityChip: {
    maxWidth: "42%",
    borderRadius: radius.panel,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  identityChipText: {
    ...typography.caption,
    fontWeight: "700",
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
