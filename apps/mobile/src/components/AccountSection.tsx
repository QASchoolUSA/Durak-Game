import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MenuButton } from "./MenuButton";
import { AuthSheet } from "./AuthSheet";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameStore } from "../game/store";
import { trigger } from "../feedback/haptics";
import { radius, spacing, typography } from "../theme";

/** ACCOUNT section for the settings sheet. Rendered only when Convex is enabled. */
export function AccountSection() {
  const ui = useUiTheme();
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const status = useQuery(
    api.account.getAccountStatus,
    isAuthenticated ? {} : "skip",
  );
  const setOnboarded = useGameStore((s) => s.setOnboarded);
  const [authOpen, setAuthOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isGuest = status?.isAnonymous ?? true;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // Drop back to the welcome/landing screen.
      setOnboarded(false);
      trigger("confirm");
    } catch {
      trigger("error");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Text style={[styles.sectionLabel, { color: ui.textPrimary }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft }]}>
        {isGuest ? (
          <>
            <Text style={[styles.hint, { color: ui.textMuted }]}>
              You're playing as a guest. Create an account to keep your
              progress and friends across devices.
            </Text>
            <MenuButton
              label="CREATE ACCOUNT / SIGN IN"
              variant="primary"
              onPress={() => setAuthOpen(true)}
            />
          </>
        ) : (
          <>
            <Text style={[styles.hint, { color: ui.textMuted }]}>
              Signed in{status?.email ? ` as ${status.email}` : ""}.
            </Text>
            <MenuButton
              label={signingOut ? "SIGNING OUT…" : "SIGN OUT"}
              variant="ghost"
              onPress={() => void handleSignOut()}
              disabled={signingOut}
            />
          </>
        )}
      </View>
      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} />
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
  hint: { ...typography.caption, lineHeight: 18 },
});
