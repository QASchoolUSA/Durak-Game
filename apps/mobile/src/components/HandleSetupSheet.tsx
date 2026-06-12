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
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MenuButton } from "./MenuButton";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameStore } from "../game/store";
import { colors, radius, spacing, typography } from "../theme";

export interface HandleSetupSheetProps {
  visible: boolean;
  initialHandle?: string;
  onClose: () => void;
  onSaved?: (handle: string) => void;
}

export function HandleSetupSheet({
  visible,
  initialHandle,
  onClose,
  onSaved,
}: HandleSetupSheetProps) {
  const ui = useUiTheme();
  const setHandleMut = useMutation(api.profiles.setHandle);
  const displayName = useGameStore((s) => s.onlineDisplayName);
  const hasCustomDisplayName = useGameStore((s) => s.hasCustomDisplayName);
  const [handle, setHandle] = useState(initialHandle ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = handle.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);

  const handleSave = async () => {
    if (normalized.length < 3) {
      setError("Handle must be at least 3 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Without a custom name the handle IS the display name — don't bake a
      // generated guest name into the profile.
      const res = await setHandleMut({
        handle: normalized,
        displayName: hasCustomDisplayName
          ? displayName.trim() || normalized
          : normalized,
      });
      if (!hasCustomDisplayName) {
        useGameStore.getState().adoptHandleDisplayName(res.handle);
      }
      onSaved?.(res.handle);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save handle.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.center}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: ui.panelBg, borderColor: ui.panelBorder }]}>
          <Text style={[styles.title, { color: ui.accent }]}>CHOOSE A HANDLE</Text>
          <Text style={[styles.sub, { color: ui.textMuted }]}>
            Friends find you by your handle. Letters, numbers, and underscores.
          </Text>
          <View style={styles.inputRow}>
            <Text style={[styles.at, { color: ui.textFaint }]}>@</Text>
            <TextInput
              style={[styles.input, { color: ui.textPrimary, borderColor: ui.panelBorderSoft }]}
              value={normalized}
              onChangeText={(t) => setHandle(t)}
              placeholder="yourname"
              placeholderTextColor={ui.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
          </View>
          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
          <MenuButton
            label={saving ? "SAVING…" : "SAVE HANDLE"}
            variant="primary"
            onPress={handleSave}
            disabled={saving || normalized.length < 3}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(4,14,9,0.76)",
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.panel,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { ...typography.title, letterSpacing: 2 },
  sub: { ...typography.body, marginBottom: spacing.sm },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  at: { ...typography.title },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 18,
    fontWeight: "700",
  },
  error: { ...typography.caption, textAlign: "center" },
});
