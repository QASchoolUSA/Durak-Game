import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Background } from "../components/Background";
import { MenuButton } from "../components/MenuButton";
import { AuthSheet } from "../components/AuthSheet";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameLayout } from "../theme/useGameLayout";
import { useGameStore } from "../game/store";
import { spacing, typography } from "../theme";

/**
 * First-run landing. "Continue as guest" proceeds with the existing anonymous
 * session; registering upgrades that same account (wallet/friends preserved).
 */
export function WelcomeScreen() {
  const ui = useUiTheme();
  const lay = useGameLayout();
  const setOnboarded = useGameStore((s) => s.setOnboarded);
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <Background variant="home">
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.content, { paddingHorizontal: lay.hPad }]}>
          <View style={styles.hero}>
            <Text style={[styles.title, { color: ui.accent, textShadowColor: ui.accent }]}>
              DURAK
            </Text>
            <Text style={[styles.tagline, { color: ui.textMuted }]}>
              The classic Russian card game
            </Text>
          </View>

          <View style={[styles.menu, { maxWidth: lay.maxContent }]}>
            <MenuButton
              label="SIGN IN / REGISTER"
              variant="primary"
              icon="➤"
              onPress={() => setAuthOpen(true)}
            />
            <MenuButton
              label="CONTINUE AS GUEST"
              variant="secondary"
              onPress={() => setOnboarded(true)}
            />
            <Text style={[styles.note, { color: ui.textFaint }]}>
              Guests can play and add friends. Create an account to keep your
              progress across devices.
            </Text>
          </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xl,
  },
  hero: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: 4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  tagline: { ...typography.body, marginTop: spacing.sm },
  menu: { width: "100%", alignSelf: "center", gap: spacing.sm },
  note: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
