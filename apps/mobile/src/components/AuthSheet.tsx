import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MenuButton } from "./MenuButton";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameStore } from "../game/store";
import { trigger } from "../feedback/haptics";
import { colors, radius, spacing, typography } from "../theme";

export interface AuthSheetProps {
  visible: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}

export function AuthSheet({ visible, onClose, onAuthenticated }: AuthSheetProps) {
  const ui = useUiTheme();
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const beginGuestUpgrade = useMutation(api.account.beginGuestUpgrade);
  const completeGuestUpgrade = useMutation(api.account.completeGuestUpgrade);

  const setOnboarded = useGameStore((s) => s.setOnboarded);

  const [mode, setMode] = useState<"signIn" | "signUp">("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mint a migration token while still signed in as the guest (if anonymous).
  const captureGuestToken = async (): Promise<string | null> => {
    if (!isAuthenticated) return null;
    try {
      const { token } = await beginGuestUpgrade({});
      return token;
    } catch {
      return null;
    }
  };

  const finishAuth = async (guestToken: string | null) => {
    if (guestToken) {
      // Retry briefly: right after sign-in the new auth token may not have
      // propagated yet, in which case the server leaves the token for a retry.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await completeGuestUpgrade({ token: guestToken });
          if (res.migrated) break;
        } catch {
          /* non-fatal: account still works, guest data just not merged */
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    setOnboarded(true);
    trigger("confirm");
    onAuthenticated?.();
    onClose();
  };

  const handleEmailAuth = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 8) {
      setError("Enter an email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const guestToken = await captureGuestToken();
    try {
      await signIn("password", { email: trimmedEmail, password, flow: mode });
      await finishAuth(guestToken);
    } catch (e) {
      setError(
        mode === "signUp"
          ? "Could not create account. The email may already be in use."
          : "Could not sign in. Check your email and password.",
      );
      trigger("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: ui.panelBg, borderColor: ui.panelBorder }]}>
          <Text style={[styles.title, { color: ui.accent }]}>
            {mode === "signUp" ? "CREATE ACCOUNT" : "SIGN IN"}
          </Text>

          <TextInput
            style={[styles.input, { color: ui.textPrimary, borderColor: ui.panelBorderSoft }]}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={ui.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={[styles.input, { color: ui.textPrimary, borderColor: ui.panelBorderSoft }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Password (min 8 chars)"
            placeholderTextColor={ui.textFaint}
            secureTextEntry
            textContentType={mode === "signUp" ? "newPassword" : "password"}
          />

          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

          <MenuButton
            label={busy ? "PLEASE WAIT…" : mode === "signUp" ? "CREATE ACCOUNT" : "SIGN IN"}
            variant="primary"
            onPress={handleEmailAuth}
            disabled={busy}
          />

          <Pressable
            onPress={() => {
              setMode(mode === "signUp" ? "signIn" : "signUp");
              setError(null);
            }}
            style={styles.switchMode}
          >
            <Text style={[styles.switchText, { color: ui.textMuted }]}>
              {mode === "signUp"
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.close}>
            <Text style={[styles.closeText, { color: ui.textFaint }]}>CANCEL</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(4,14,9,0.78)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.title, letterSpacing: 2, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  error: { ...typography.caption, textAlign: "center" },
  switchMode: { alignItems: "center", paddingVertical: spacing.xs },
  switchText: { ...typography.caption },
  close: { alignItems: "center", paddingVertical: spacing.xs },
  closeText: { ...typography.caption, letterSpacing: 1 },
});
