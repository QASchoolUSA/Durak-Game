import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

export interface TurnTimerProps {
  /** 1 = full time remaining, 0 = expired. */
  progress: number;
  seconds: number;
  label?: string;
}

function TurnTimerComponent({ progress, seconds, label = "Your turn" }: TurnTimerProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const low = clamped < 0.3;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label} · {Math.ceil(seconds)}s
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${clamped * 100}%`, backgroundColor: low ? colors.danger : colors.gold },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: "70%" },
  label: { color: colors.textLight, fontWeight: "700", fontSize: 12, marginBottom: 4 },
  track: {
    width: "100%",
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.feltEdge,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radius.pill },
});

export const TurnTimer = React.memo(TurnTimerComponent);
