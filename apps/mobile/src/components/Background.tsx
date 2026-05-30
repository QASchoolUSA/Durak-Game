import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

export function Background({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={[colors.feltTop, colors.feltBottom]} style={styles.fill}>
      {/* Subtle vignette for depth. */}
      <View style={styles.vignette} pointerEvents="none" />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  vignette: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
});
