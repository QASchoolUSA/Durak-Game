import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../theme";

export interface TurnProgressBarProps {
  progress: number;
}

function TurnProgressBarComponent({ progress }: TurnProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const low = clamped < 0.3;
  const barColor = low ? colors.danger : clamped < 0.55 ? colors.gold : colors.success;

  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: barColor },
          low && styles.fillLow,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.feltEdge,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radius.pill },
  fillLow: {
    shadowColor: colors.danger,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});

export const TurnProgressBar = React.memo(TurnProgressBarComponent);
