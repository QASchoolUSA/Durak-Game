import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../theme";

export interface ConfirmDialogProps {
  visible:        boolean;
  title:          string;
  message:        string;
  confirmLabel?:  string;
  cancelLabel?:   string;
  onConfirm:      () => void;
  onCancel:       () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Warning icon */}
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>!</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.cancelBtn]} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.confirmBtn]} onPress={onConfirm}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.feltMid,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: "rgba(229, 72, 77, 0.35)",
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.panel,
  },

  // Warning icon
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(229, 72, 77, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(229, 72, 77, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  icon: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },

  title: {
    ...typography.heading,
    color: colors.textLight,
    textAlign: "center",
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: "rgba(231, 192, 103, 0.25)",
  },
  confirmBtn: {
    backgroundColor: colors.danger,
    ...shadows.dangerGlow,
  },
  cancelText: {
    ...typography.body,
    color: colors.textLight,
    fontWeight: "700",
  },
  confirmText: {
    ...typography.body,
    color: "#fff",
    fontWeight: "800",
  },
});
