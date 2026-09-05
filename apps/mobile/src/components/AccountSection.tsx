import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
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
  const { t } = useTranslation();
  const ui = useUiTheme();
  const { signOut } = useAuthActions();
  const deleteAccount = useMutation(api.account.deleteAccount);
  const { ensureGuestSession } = useOnlineAuth();
  const { isGuest, email, handle, markRegistered, markGuest } = useAccountKind();
  const setOnboarded = useGameStore((s) => s.setOnboarded);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signUp");
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      t("settings.account.signOutTitle"),
      t("settings.account.signOutBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.account.signOutConfirm"),
          style: "destructive",
          onPress: () => void performSignOut(),
        },
      ],
    );
  };

  const performDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      markGuest();
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
      Alert.alert(t("common.somethingWentWrong"), t("settings.account.deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("settings.account.deleteTitle"),
      t("settings.account.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.account.deleteConfirm"),
          style: "destructive",
          onPress: () => void performDeleteAccount(),
        },
      ],
    );
  };

  return (
    <>
      <View style={styles.inner}>
        {isGuest ? (
          <>
            <Text style={[styles.hint, { color: ui.textMuted }]}>
              {t("settings.account.guestHint")}
            </Text>
            <MenuButton
              label={t("welcome.createAccount")}
              variant="primary"
              onPress={() => {
                setAuthMode("signUp");
                setAuthOpen(true);
              }}
            />
            <MenuButton
              label={t("welcome.signIn")}
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
              {t("settings.account.signedIn", {
                as: email ? t("settings.account.signedInAs", { identity: email }) : "",
              })}
            </Text>
            <MenuButton
              label={signingOut ? t("settings.account.signingOut") : t("settings.account.signOut")}
              variant="ghost"
              onPress={handleSignOut}
              disabled={signingOut || deleting}
            />
            <MenuButton
              label={deleting ? t("settings.account.deletingAccount") : t("settings.account.deleteAccount")}
              variant="danger"
              onPress={handleDeleteAccount}
              disabled={signingOut || deleting}
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
  inner: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  identity: {
    ...typography.label,
    fontWeight: "800",
  },
  hint: { ...typography.caption, lineHeight: 18 },
});
