import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { SeatRole } from "../game/selectors";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, spacing, typography } from "../theme";
import { colors } from "../theme";
import { TurnProgressBar } from "./TurnTimer";

export interface YourTurnBannerProps {
  label: string;
  role: SeatRole | null;
  seconds?: number;
  totalSeconds?: number;
}

function roleLabel(role: SeatRole): string | null {
  if (role === "attacker") return "ATTACKING";
  if (role === "defender") return "DEFENDING";
  if (role === "taking") return "TAKING";
  return null;
}

function RolePill({ role }: { role: SeatRole }) {
  const text = roleLabel(role);
  if (!text) return null;

  const isAttacker = role === "attacker";
  const isTaking = role === "taking";

  return (
    <View
      style={[
        styles.rolePill,
        isAttacker && styles.rolePillAttack,
        role === "defender" && styles.rolePillDefend,
        isTaking && styles.rolePillTaking,
      ]}
    >
      <Text
        style={[
          styles.rolePillText,
          isAttacker && styles.rolePillTextAttack,
          role === "defender" && styles.rolePillTextDefend,
          isTaking && styles.rolePillTextTaking,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function YourTurnBannerComponent({
  label,
  role,
  seconds,
  totalSeconds,
}: YourTurnBannerProps) {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();
  const showTimer =
    seconds !== undefined && totalSeconds !== undefined && totalSeconds > 0;
  const progress = showTimer ? seconds / totalSeconds : 0;
  const low = showTimer && progress < 0.3;

  const content = (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: ui.accentSoft,
          borderColor: ui.panelBorder,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.yourTurn, { color: ui.accent }]}>YOUR TURN</Text>
          {role && <RolePill role={role} />}
        </View>
        {showTimer && (
          <Text style={[styles.seconds, low && styles.secondsLow]}>
            {Math.ceil(seconds)}s
          </Text>
        )}
      </View>
      <Text style={[styles.hint, { color: ui.textMuted }]}>{label}</Text>
      {showTimer && <TurnProgressBar progress={progress} />}
    </View>
  );

  if (reduceMotion) {
    return content;
  }

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: radius.panel,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  yourTurn: {
    ...typography.caption,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  hint: {
    ...typography.caption,
    fontWeight: "700",
  },
  seconds: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: "800",
  },
  secondsLow: { color: colors.danger },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  rolePillAttack: { backgroundColor: "#9E1E27" },
  rolePillDefend: { backgroundColor: "#8A6A18" },
  rolePillTaking: { backgroundColor: "rgba(120, 90, 160, 0.85)" },
  rolePillText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  rolePillTextAttack: { color: "#FFCED0" },
  rolePillTextDefend: { color: "#FFE9A0" },
  rolePillTextTaking: { color: "#E8D8FF" },
});

export const YourTurnBanner = React.memo(YourTurnBannerComponent);
