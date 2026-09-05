import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Difficulty } from "../game/store";
import { colors, radius, spacing, typography } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";

const DIFF_META: {
  id: Difficulty;
  labelKey: string;
  descKey: string;
  pips: number;
  color: string;
  activeBg: string;
}[] = [
  {
    id: "easy",
    labelKey: "config.difficulty.easy",
    descKey: "config.difficulty.easyDesc",
    pips: 1,
    color: colors.success,
    activeBg: "rgba(70,167,88,0.14)",
  },
  {
    id: "medium",
    labelKey: "config.difficulty.medium",
    descKey: "config.difficulty.mediumDesc",
    pips: 3,
    color: colors.gold,
    activeBg: "rgba(231,192,103,0.14)",
  },
  {
    id: "hard",
    labelKey: "config.difficulty.hard",
    descKey: "config.difficulty.hardDesc",
    pips: 5,
    color: colors.danger,
    activeBg: "rgba(229,72,77,0.14)",
  },
];

/** Kept for pips/color lookups outside the picker. */
export const DIFF_OPTIONS = DIFF_META.map((d) => ({
  id: d.id,
  pips: d.pips,
  color: d.color,
  activeBg: d.activeBg,
}));

export interface DifficultyPickerProps {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
}

export function DifficultyPicker({ value, onChange }: DifficultyPickerProps) {
  const { t } = useTranslation();
  const ui = useUiTheme();

  return (
    <View style={styles.row}>
      {DIFF_META.map((d) => {
        const active = value === d.id;
        return (
          <Pressable
            key={d.id}
            style={[
              styles.btn,
              {
                borderColor: ui.panelBorderSoft,
                backgroundColor: ui.panelBg,
              },
              active && { borderColor: d.color, backgroundColor: d.activeBg },
            ]}
            onPress={() => onChange(d.id)}
          >
            <View style={styles.pipRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    {
                      backgroundColor:
                        i < d.pips ? d.color : ui.panelBorderSoft,
                    },
                  ]}
                />
              ))}
            </View>
            <Text
              style={[
                styles.label,
                { color: ui.textPrimary },
                active && { color: d.color },
              ]}
            >
              {t(d.labelKey)}
            </Text>
            <Text style={[styles.desc, { color: ui.textMuted }, active && { color: ui.textPrimary }]}>{t(d.descKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  btn: {
    flex: 1,
    minHeight: 66,
    borderRadius: radius.panel,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
  },
  pipRow: { flexDirection: "row", gap: 4 },
  pip: { width: 6, height: 6, borderRadius: 3 },
  label: { ...typography.heading, fontWeight: "800" },
  desc: { ...typography.caption, fontWeight: "500", letterSpacing: 0.1 },
});
