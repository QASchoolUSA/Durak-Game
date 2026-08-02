import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
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
import { spacing, typography } from "../theme";
import { isExpoGo } from "../utils/isExpoGo";

/**
 * First-run landing. "Continue as guest" proceeds with the existing anonymous
 * session; registering upgrades that same account (wallet/friends preserved).
 * Mirrors the home screen's hero panel so the transition feels seamless.
 */
export function WelcomeScreen() {
  const ui = useUiTheme();
  const lay = useGameLayout();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const setOnboarded = useGameStore((s) => s.setOnboarded);
  const [authOpen, setAuthOpen] = useState(false);
  const animate = !isExpoGo && !reduceMotion && appActive;

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
        The classic Russian card game
      </Text>
    </HeroPanel>
  );

  const menu = (
    <>
      <MenuButton
        label="SIGN IN / REGISTER"
        variant="primary"
        icon="➤"
        onPress={() => setAuthOpen(true)}
      />
      <MenuButton
        label="CONTINUE AS GUEST"
        variant="secondary"
        icon="♠"
        onPress={() => setOnboarded(true)}
      />
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

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} />
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
});
