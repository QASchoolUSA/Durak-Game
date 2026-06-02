import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "../theme";

export interface TurnTimerProps {
  progress: number;
  seconds:  number;
  label?:   string;
}

function TurnTimerComponent({ progress, seconds, label = "Your turn" }: TurnTimerProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const low = clamped < 0.3;
  const barColor = low ? colors.danger : clamped < 0.55 ? colors.gold : colors.success;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.seconds, low && styles.secondsLow]}>
          {Math.ceil(seconds)}s
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${clamped * 100}%`, backgroundColor: barColor },
            low && styles.fillLow,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "stretch" },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  seconds: {
    ...typography.caption,
    color: colors.gold,
    fontWeight: "800",
  },
  secondsLow: { color: colors.danger },
  track: {
    width: "100%",
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.feltEdge,
    overflow: "hidden",
  },
  fill:    { height: "100%", borderRadius: radius.pill },
  fillLow: {
    shadowColor: colors.danger,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});

export const TurnTimer = React.memo(TurnTimerComponent);
