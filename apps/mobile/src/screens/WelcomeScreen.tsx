import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Background } from "../components/Background";
import { CardFan } from "../components/CardFan";
import { GlowTitle, HeroPanel, StaticTitle } from "../components/HomeHero";
import { MenuButton } from "../components/MenuButton";
import { AuthSheet } from "../components/AuthSheet";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameLayout } from "../theme/useGameLayout";
import { useAppActive } from "../hooks/useAppActive";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useGameStore } from "../game/store";
import { useOnlineAuth } from "../game/useAuthBootstrap";
import { useAccountKind } from "../game/useAccountKind";
import { spacing, typography } from "../theme";
import { isExpoGo } from "../utils/isExpoGo";
import { trigger } from "../feedback/haptics";

type AuthMode = "signIn" | "signUp";

/**
 * First-run landing. Create Account / Sign In open the auth sheet;
 * Continue as Guest mints an anonymous session then enters the home screen.
 */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const ui = useUiTheme();
  const lay = useGameLayout();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const setOnboarded = useGameStore((s) => s.setOnboarded);
  const { ensureGuestSession } = useOnlineAuth();
  const { markRegistered } = useAccountKind();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signUp");
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const animate = !isExpoGo && !reduceMotion && appActive;

  const openAuth = (mode: AuthMode) => {
    setGuestError(null);
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const continueAsGuest = async () => {
    if (guestBusy) return;
    setGuestBusy(true);
    setGuestError(null);
    try {
      await ensureGuestSession();
      setOnboarded(true);
      trigger("confirm");
    } catch {
      setGuestError(t("welcome.guestError"));
      trigger("error");
    } finally {
      setGuestBusy(false);
    }
  };

  const hero = (
    <HeroPanel maxWidth={lay.maxContent}>
      <View
        style={[
          styles.fanWrap,
          { height: lay.s(150), marginBottom: lay.s(spacing.sm) },
        ]}
      >
        <CardFan animate={animate} />
      </View>
      {animate ? <GlowTitle /> : <StaticTitle />}
      <Text style={[styles.tagline, { color: ui.textMuted }]}>
        {t("welcome.tagline")}
      </Text>
    </HeroPanel>
  );

  const menu = (
    <>
      <MenuButton
        label={t("welcome.createAccount")}
        variant="primary"
        icon="➤"
        onPress={() => openAuth("signUp")}
      />
      <MenuButton
        label={t("welcome.signIn")}
        variant="secondary"
        icon="✉"
        onPress={() => openAuth("signIn")}
      />
      <MenuButton
        label={guestBusy ? t("welcome.starting") : t("welcome.continueAsGuest")}
        variant="ghost"
        icon="♠"
        onPress={() => void continueAsGuest()}
        disabled={guestBusy}
      />
      {guestError ? (
        <Text style={[styles.guestError, { color: ui.textMuted }]}>{guestError}</Text>
      ) : null}
    </>
  );

  return (
    <Background variant="home" deferAmbience={!animate}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.content, { paddingHorizontal: lay.hPad }]}>
          {animate ? (
            <Animated.View
              entering={FadeIn.duration(350).easing(Easing.out(Easing.cubic))}
              style={styles.heroArea}
            >
              {hero}
            </Animated.View>
          ) : (
            <View style={styles.heroArea}>{hero}</View>
          )}

          {animate ? (
            <Animated.View
              entering={FadeInDown.delay(120)
                .duration(350)
                .easing(Easing.out(Easing.cubic))}
              style={[styles.menu, { maxWidth: lay.maxContent }]}
            >
              {menu}
            </Animated.View>
          ) : (
            <View style={[styles.menu, { maxWidth: lay.maxContent }]}>{menu}</View>
          )}
        </View>
      </SafeAreaView>

      <AuthSheet
        visible={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={markRegistered}
        initialMode={authMode}
      />
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xl,
  },
  heroArea: {
    alignItems: "center",
  },
  fanWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tagline: {
    ...typography.body,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  menu: {
    width: "100%",
    alignSelf: "center",
    gap: spacing.sm,
  },
  guestError: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
