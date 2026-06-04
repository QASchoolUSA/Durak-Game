import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, spacing, typography } from "../theme";
import { trigger } from "../feedback/haptics";

export interface CoachStep {
  title: string;
  body: string;
}

interface GameCoachOverlayProps {
  visible: boolean;
  steps: CoachStep[];
  stepIndex: number;
  onNext: () => void;
  onDismiss: () => void;
}

export function GameCoachOverlay({
  visible,
  steps,
  stepIndex,
  onNext,
  onDismiss,
}: GameCoachOverlayProps) {
  const ui = useUiTheme();
  const step = steps[stepIndex];
  if (!step) return null;

  const isLast = stepIndex >= steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
          ]}
        >
          <Text style={[styles.kicker, { color: ui.textFaint }]}>
            TIP {stepIndex + 1} / {steps.length}
          </Text>
          <Text style={[styles.title, { color: ui.accent }]}>{step.title}</Text>
          <Text style={[styles.body, { color: ui.textMuted }]}>{step.body}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                trigger("uiTap");
                onDismiss();
              }}
              hitSlop={8}
            >
              <Text style={[styles.skip, { color: ui.textFaint }]}>Skip</Text>
            </Pressable>
            <Pressable
              style={[styles.nextBtn, { backgroundColor: ui.accent }]}
              onPress={() => {
                trigger("uiTap");
                if (isLast) onDismiss();
                else onNext();
              }}
            >
              <Text style={[styles.nextText, { color: ui.badgeText }]}>
                {isLast ? "Got it" : "Next"}
              </Text>
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
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    borderRadius: radius.panel,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  kicker: {
    ...typography.label,
    letterSpacing: 1.2,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
  },
  body: {
    ...typography.body,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  skip: {
    ...typography.body,
    fontWeight: "600",
  },
  nextBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  nextText: {
    ...typography.body,
    fontWeight: "800",
  },
});
