import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, radius, spacing } from "../theme";
import { trigger } from "../feedback/haptics";
import { DOCK_ROW_HEIGHT, dockPillStyles } from "./dockPill";

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

const BURST_BOTTOM = 96;
const SHEET_HEIGHT = 220;
const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

interface Burst {
  id: number;
  emoji: string;
}

function ReactionsBarComponent() {
  const insets = useSafeAreaInsets();
  const sheetH = SHEET_HEIGHT + insets.bottom;

  const [bursts, setBursts] = useState<Burst[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const prevOpen = useRef(pickerOpen);

  const ty = useSharedValue(sheetH);
  const backdropO = useSharedValue(0);
  const sheetHSV = useSharedValue(sheetH);
  useEffect(() => { sheetHSV.value = sheetH; }, [sheetH, sheetHSV]);

  const react = useCallback((emoji: string) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, emoji }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1200);
  }, []);

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value = withSpring(sheetH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [sheetH, ty, backdropO],
  );

  const closeDrawer = useCallback(() => {
    animateOut(() => {
      setModalVisible(false);
      setPickerOpen(false);
    });
  }, [animateOut]);

  const openDrawer = useCallback(() => {
    setPickerOpen(true);
  }, []);

  useEffect(() => {
    if (pickerOpen && !prevOpen.current) {
      ty.value = sheetH;
      backdropO.value = 0;
      setModalVisible(true);
    }
    if (!pickerOpen && prevOpen.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevOpen.current = pickerOpen;
  }, [pickerOpen, sheetH, modalVisible, ty, backdropO, animateOut]);

  const onModalShow = useCallback(() => {
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO]);

  const pickReaction = useCallback(
    (emoji: string) => {
      trigger("selection");
      react(emoji);
      closeDrawer();
    },
    [react, closeDrawer],
  );

  const swipeDown = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-22, 22])
    .onUpdate((e) => {
      const drag = Math.max(0, e.translationY);
      ty.value = drag;
      backdropO.value = Math.max(0, BACKDROP_FULL * (1 - drag / (sheetHSV.value * 0.55)));
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 650) {
        ty.value = withSpring(sheetHSV.value, SPRING_OUT, () => {
          runOnJS(setModalVisible)(false);
          runOnJS(setPickerOpen)(false);
        });
        backdropO.value = withTiming(0, { duration: 210 });
      } else {
        ty.value = withSpring(0, SPRING_IN);
        backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
      }
    });

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <>
      <View style={styles.wrap}>
        <View style={styles.bursts} pointerEvents="none">
          {bursts.map((b) => (
            <Animated.Text
              key={b.id}
              entering={FadeIn}
              exiting={FadeOutUp.duration(900)}
              style={styles.burst}
            >
              {b.emoji}
            </Animated.Text>
          ))}
        </View>

        <View style={styles.triggerRow}>
          <Pressable
            style={dockPillStyles.pill}
            onPress={pickerOpen ? closeDrawer : openDrawer}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reactions"
          >
            <Text style={dockPillStyles.icon}>{"\u{1F600}"}</Text>
            <Text style={dockPillStyles.label}>React</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onShow={onModalShow}
        onRequestClose={closeDrawer}
      >
        <GestureHandlerRootView style={styles.gestureRoot}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
          </Animated.View>

          <Animated.View style={[styles.sheet, { height: sheetH }, aSheet]}>
            <GestureDetector gesture={swipeDown}>
              <View style={styles.handleZone}>
                <View style={styles.handle} />
                <Text style={styles.handleHint}>Swipe down to close</Text>
              </View>
            </GestureDetector>

            <Text style={styles.sheetTitle}>Pick a reaction</Text>
            <View style={[styles.grid, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
              {REACTIONS.map(({ emoji, label }) => (
                <Pressable key={emoji} style={styles.option} onPress={() => pickReaction(emoji)}>
                  <Text style={styles.optionEmoji}>{emoji}</Text>
                  <Text style={styles.optionLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: DOCK_ROW_HEIGHT,
    overflow: "visible",
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
  triggerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: DOCK_ROW_HEIGHT,
  },
  gestureRoot: { flex: 1 },
  backdrop: { backgroundColor: "rgba(4,14,9,1)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.feltBottom,
    borderTopLeftRadius: radius.panel + 6,
    borderTopRightRadius: radius.panel + 6,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.goldDim,
    paddingHorizontal: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
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
