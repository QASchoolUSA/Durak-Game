import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { MenuButton } from "./MenuButton";
import { AuthSheet } from "./AuthSheet";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameStore } from "../game/store";
import { useAccountKind } from "../game/useAccountKind";
import { useOnlineAuth } from "../game/useAuthBootstrap";
import { trigger } from "../feedback/haptics";
import { radius, spacing, typography } from "../theme";

/** ACCOUNT section for the settings sheet. Rendered only when Convex is enabled. */
export function AccountSection() {
  const ui = useUiTheme();
  const { signOut } = useAuthActions();
  const { ensureGuestSession } = useOnlineAuth();
  const { isGuest, email, handle, markRegistered, markGuest } = useAccountKind();
  const setOnboarded = useGameStore((s) => s.setOnboarded);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signUp");
  const [signingOut, setSigningOut] = useState(false);

  const performSignOut = async () => {
    setSigningOut(true);
    markGuest();
    try {
      await signOut();
      try {
        await ensureGuestSession();
      } catch {
        /* Welcome can retry via Continue as Guest */
      }
      setOnboarded(false);
      trigger("confirm");
    } catch {
      trigger("error");
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "You'll return to the welcome screen. You can continue as a guest or sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void performSignOut(),
        },
      ],
    );
  };

  return (
    <>
      <Text style={[styles.sectionLabel, { color: ui.textPrimary }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft }]}>
        {isGuest ? (
          <>
            <Text style={[styles.hint, { color: ui.textMuted }]}>
              You're playing as a guest. Create an account with an @handle to
              add friends and get game invites.
            </Text>
            <MenuButton
              label="CREATE ACCOUNT"
              variant="primary"
              onPress={() => {
                setAuthMode("signUp");
                setAuthOpen(true);
              }}
            />
            <MenuButton
              label="SIGN IN"
              variant="secondary"
              onPress={() => {
                setAuthMode("signIn");
                setAuthOpen(true);
              }}
            />
          </>
        ) : (
          <>
            {handle ? (
              <Text style={[styles.identity, { color: ui.textPrimary }]}>
                @{handle}
              </Text>
            ) : null}
            <Text style={[styles.hint, { color: ui.textMuted }]}>
              Signed in{email ? ` as ${email}` : ""}.
            </Text>
            <MenuButton
              label={signingOut ? "SIGNING OUT…" : "SIGN OUT"}
              variant="ghost"
              onPress={handleSignOut}
              disabled={signingOut}
            />
          </>
        )}
      </View>
      <AuthSheet
        visible={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={markRegistered}
        initialMode={authMode}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...typography.label,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  card: {
    borderRadius: radius.panel,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  identity: {
    ...typography.label,
    fontWeight: "800",
  },
  hint: { ...typography.caption, lineHeight: 18 },
});
