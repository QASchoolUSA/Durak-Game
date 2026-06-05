import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useGameStore } from "../game/store";
import { radius, spacing } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { trigger } from "../feedback/haptics";

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

const SHEET_HEIGHT = 220;
const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

export interface ReactionsHostRef {
  open: () => void;
}

const ReactionsHostComponent = forwardRef<ReactionsHostRef>(function ReactionsHostComponent(
  _props,
  ref,
) {
  const playMode = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const triggerLocalReaction = useGameStore((s) => s.triggerLocalReaction);
  const sendReactionMut = useMutation(api.rooms.sendReaction);
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const insets = useSafeAreaInsets();
  const sheetH = SHEET_HEIGHT + insets.bottom;

  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    ui.feltEdge,
  ];

  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const prevOpen = useRef(pickerOpen);

  const ty = useSharedValue(sheetH);
  const backdropO = useSharedValue(0);
  const sheetHSV = useSharedValue(sheetH);
  useEffect(() => { sheetHSV.value = sheetH; }, [sheetH, sheetHSV]);

  const react = useCallback(
    (emoji: string) => {
      triggerLocalReaction(emoji);
      if (playMode === "online" && onlineRoomId) {
        void sendReactionMut({
          roomId: onlineRoomId as Id<"rooms">,
          emoji,
        });
      }
    },
    [playMode, onlineRoomId, sendReactionMut, triggerLocalReaction],
  );

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

  useImperativeHandle(ref, () => ({ open: openDrawer }), [openDrawer]);

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

          <Animated.View
            style={[
              styles.sheet,
              {
                height: sheetH,
                borderColor: ui.accentMuted,
              },
              aSheet,
            ]}
          >
            <LinearGradient
              colors={sheetGradient}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            <GestureDetector gesture={swipeDown}>
              <View style={styles.handleZone}>
                <View style={[styles.handle, { backgroundColor: ui.accentMuted }]} />
                <Text style={[styles.handleHint, { color: ui.textMuted }]}>
                  Swipe down to close
                </Text>
              </View>
            </GestureDetector>

            <Text style={[styles.sheetTitle, { color: ui.textPrimary }]}>
              Pick a reaction
            </Text>
            <View style={[styles.grid, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
              {REACTIONS.map(({ emoji, label }) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.option,
                    {
                      backgroundColor: ui.panelBg,
                      borderColor: ui.accentMuted,
                    },
                  ]}
                  onPress={() => pickReaction(emoji)}
                >
                  <Text style={styles.optionEmoji}>{emoji}</Text>
                  <Text style={[styles.optionLabel, { color: ui.textMuted }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  backdrop: { backgroundColor: "rgba(4,14,9,1)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.panel + 6,
    borderTopRightRadius: radius.panel + 6,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.md,
    overflow: "hidden",
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
    marginBottom: 4,
  },
  handleHint: {
    fontSize: 10,
    fontWeight: "600",
  },
  sheetTitle: {
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
    borderRadius: radius.panel,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  optionEmoji: { fontSize: 26, marginBottom: 2 },
  optionLabel: { fontSize: 10, fontWeight: "600" },
});

export const ReactionsHost = React.memo(ReactionsHostComponent);

/** @deprecated Use ReactionsHost */
export const ReactionsBar = ReactionsHost;
