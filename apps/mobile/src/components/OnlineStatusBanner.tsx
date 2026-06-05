import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGameStore } from "../game/store";
import { spacing } from "../theme";

export function OnlineStatusBanner() {
  const message = useGameStore((s) => s.onlineStatusMessage);
  const clear = useGameStore((s) => s.clearOnlineStatusMessage);

  if (!message) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable style={styles.banner} onPress={clear}>
        <Text style={styles.text}>{message}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 52,
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
  },
  banner: {
    backgroundColor: "rgba(12, 45, 34, 0.92)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(231, 192, 103, 0.35)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    color: "#F5F3EC",
    fontSize: 13,
    textAlign: "center",
  },
});
