import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOutUp,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, radius, spacing } from "../theme";

const REACTIONS = [
  { emoji: "\u{1F44D}", label: "Nice" },
  { emoji: "\u23F0", label: "Hurry up" },
  { emoji: "\u{1F602}", label: "LOL" },
  { emoji: "\u{1F44F}", label: "Clap" },
  { emoji: "\u{1F62E}", label: "Wow" },
  { emoji: "\u{1F914}", label: "Hmm" },
  { emoji: "\u{1F624}", label: "Angry" },
  { emoji: "\u{1F44E}", label: "Nope" },
];

const BURST_BOTTOM = 248;
const DRAWER_HEIGHT = 220;
const REACT_ROW_HEIGHT = 44;
/** Nudge the React / Close pill toward the bottom edge (closed vs open). */
const TRIGGER_SHIFT_CLOSED = 10;
const TRIGGER_SHIFT_OPEN = 28;
/** Fully off-screen: drawer height + buffer for shadow / safe-area variance. */
const DRAWER_CLOSED_Y = DRAWER_HEIGHT + 32;
const SPRING = { damping: 22, stiffness: 240, mass: 0.85 };

interface Burst {
  id: number;
  emoji: string;
}

function ReactionsBarComponent() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const drawerY = useSharedValue(DRAWER_CLOSED_Y);
  const dragStartY = useSharedValue(DRAWER_CLOSED_Y);

  useEffect(() => {
    drawerY.value = withSpring(pickerOpen ? 0 : DRAWER_CLOSED_Y, SPRING);
  }, [pickerOpen, drawerY]);

  const react = useCallback((emoji: string) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, emoji }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1200);
  }, []);

  const closeDrawer = useCallback(() => setPickerOpen(false), []);
  const openDrawer = useCallback(() => setPickerOpen(true), []);

  const pickReaction = useCallback(
    (emoji: string) => {
      react(emoji);
      closeDrawer();
    },
    [react, closeDrawer],
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragStartY.value = drawerY.value;
    })
    .onUpdate((e) => {
      drawerY.value = Math.max(
        0,
        Math.min(DRAWER_CLOSED_Y, dragStartY.value + e.translationY),
      );
    })
    .onEnd((e) => {
      const shouldClose =
        drawerY.value > DRAWER_CLOSED_Y * 0.25 || e.velocityY > 700;
      if (shouldClose) {
        runOnJS(closeDrawer)();
      } else {
        drawerY.value = withSpring(0, SPRING);
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drawerY.value }],
    opacity: drawerY.value >= DRAWER_CLOSED_Y - 2 ? 0 : 1,
  }));

  const triggerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          drawerY.value,
          [0, DRAWER_CLOSED_Y],
          [TRIGGER_SHIFT_OPEN, TRIGGER_SHIFT_CLOSED],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.bursts} pointerEvents="none">
        {bursts.map((b) => (
          <Animated.Text key={b.id} entering={FadeIn} exiting={FadeOutUp.duration(900)} style={styles.burst}>
            {b.emoji}
          </Animated.Text>
        ))}
      </View>

      <Animated.View
        style={[styles.drawer, drawerStyle]}
        pointerEvents={pickerOpen ? "auto" : "none"}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.handleZone}>
            <View style={styles.handle} />
            <Text style={styles.handleHint}>Swipe down to close</Text>
          </View>
        </GestureDetector>

        <Text style={styles.sheetTitle}>Pick a reaction</Text>
        <View style={styles.grid}>
          {REACTIONS.map(({ emoji, label }) => (
            <Pressable key={emoji} style={styles.option} onPress={() => pickReaction(emoji)}>
              <Text style={styles.optionEmoji}>{emoji}</Text>
              <Text style={styles.optionLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[styles.triggerWrap, triggerStyle]}>
        <Pressable
          style={[styles.trigger, pickerOpen && styles.triggerActive]}
          onPress={pickerOpen ? closeDrawer : openDrawer}
          hitSlop={8}
        >
          <Text style={styles.triggerEmoji}>{"\u{1F600}"}</Text>
          <Text style={styles.triggerLabel}>{pickerOpen ? "Close" : "React"}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    width: "100%",
    height: REACT_ROW_HEIGHT,
    overflow: "visible",
    zIndex: 10,
  },
  bursts: {
    position: "absolute",
    bottom: BURST_BOTTOM,
    left: 0,
    right: 0,
    height: 72,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    zIndex: 30,
  },
  burst: { fontSize: 36 },
  drawer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: DRAWER_HEIGHT,
    backgroundColor: colors.feltBottom,
    borderTopLeftRadius: radius.panel + 6,
    borderTopRightRadius: radius.panel + 6,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.goldDim,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
    zIndex: 40,
  },
  handleZone: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.goldDim,
    marginBottom: 4,
  },
  handleHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  triggerWrap: {
    position: "absolute",
    alignSelf: "center",
    bottom: 0,
    zIndex: 50,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  triggerActive: {
    borderColor: colors.gold,
    backgroundColor: colors.feltEdge,
  },
  triggerEmoji: { fontSize: 20 },
  triggerLabel: { color: colors.textLight, fontWeight: "700", fontSize: 14 },
  sheetTitle: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  option: {
    width: "22%",
    minWidth: 68,
    alignItems: "center",
    backgroundColor: colors.panel,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.goldDim,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  optionEmoji: { fontSize: 26, marginBottom: 2 },
  optionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "600" },
});

export const ReactionsBar = React.memo(ReactionsBarComponent);
