import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

export function Background({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={[colors.feltTop, colors.feltMid, colors.feltBottom]}
      locations={[0, 0.45, 1]}
      style={styles.fill}
    >
      {/* Radial-style vignette: dark corners, transparent center */}
      <View style={styles.vignetteTop}    pointerEvents="none" />
      <View style={styles.vignetteBottom} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  vignetteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "35%",
    backgroundColor: "rgba(4, 14, 9, 0.28)",
    pointerEvents: "none",
  } as any,
  vignetteBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(4, 14, 9, 0.35)",
    pointerEvents: "none",
  } as any,
});
