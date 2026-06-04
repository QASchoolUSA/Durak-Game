import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

const BUBBLE_BG = "#E9E9EB";
const BUBBLE_TEXT = "#1C1C1E";

function TakeSpeechBubbleComponent() {
  return (
    <Animated.View
      entering={FadeIn.duration(220).springify().damping(18)}
      style={styles.wrap}
      pointerEvents="none"
    >
      <Animated.View entering={ZoomIn.duration(220).springify().damping(16)} style={styles.bubble}>
        <Text style={styles.text} numberOfLines={1}>
          I take
        </Text>
      </Animated.View>
      <View style={styles.tailRow}>
        <View style={styles.tail} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: "100%",
    left: -8,
    marginBottom: -2,
    alignItems: "flex-start",
    flexShrink: 0,
    zIndex: 20,
  },
  tailRow: {
    height: 5,
    marginLeft: 10,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: BUBBLE_BG,
  },
  bubble: {
    backgroundColor: BUBBLE_BG,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    minWidth: 52,
    flexShrink: 0,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  text: {
    color: BUBBLE_TEXT,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: -0.1,
    flexShrink: 0,
  },
});

export const TakeSpeechBubble = React.memo(TakeSpeechBubbleComponent);
