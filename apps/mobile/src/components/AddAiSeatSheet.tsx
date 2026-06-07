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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { Difficulty } from "../game/store";
import { trigger } from "../feedback/haptics";
import { radius, spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { DifficultyPicker } from "./DifficultyPicker";
import { MenuButton } from "./MenuButton";

const SHEET_BODY_HEIGHT = 320;
const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

export interface AddAiSeatSheetProps {
  visible: boolean;
  seatIndex: number;
  initialDifficulty: Difficulty;
  onClose: () => void;
  onConfirm: (difficulty: Difficulty) => void | Promise<void>;
}

export function AddAiSeatSheet({
  visible,
  seatIndex,
  initialDifficulty,
  onClose,
  onConfirm,
}: AddAiSeatSheetProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const insets = useSafeAreaInsets();
  const lay = useGameLayout();
  const sheetBodyH = lay.s(SHEET_BODY_HEIGHT);
  const sheetH = sheetBodyH + insets.bottom;

  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    ui.feltEdge,
  ];

  const [modalVisible, setModalVisible] = useState(false);
  const [draftDifficulty, setDraftDifficulty] =
    useState<Difficulty>(initialDifficulty);
  const [confirming, setConfirming] = useState(false);
  const prevVisible = useRef(visible);

  const ty = useSharedValue(sheetH);
  const backdropO = useSharedValue(0);
  const sheetHSV = useSharedValue(sheetH);
  useEffect(() => {
    sheetHSV.value = sheetH;
  }, [sheetH, sheetHSV]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value = withSpring(sheetH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [sheetH, ty, backdropO],
  );

  const closeSheet = useCallback(() => {
    if (confirming) return;
    animateOut(() => {
      setModalVisible(false);
      onClose();
    });
  }, [animateOut, onClose, confirming]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setDraftDifficulty(initialDifficulty);
      ty.value = sheetH;
      backdropO.value = 0;
      setModalVisible(true);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [
    visible,
    initialDifficulty,
    sheetH,
    modalVisible,
    ty,
    backdropO,
    animateOut,
  ]);

  const onModalShow = useCallback(() => {
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO]);

  const handleConfirm = useCallback(async () => {
    if (confirming) return;
    setConfirming(true);
    trigger("confirm");
    try {
      await onConfirm(draftDifficulty);
      animateOut(() => {
        setModalVisible(false);
        onClose();
      });
    } catch {
      trigger("error");
    } finally {
      setConfirming(false);
    }
  }, [confirming, draftDifficulty, onConfirm, animateOut, onClose]);

  const swipeDown = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-22, 22])
    .onUpdate((e) => {
      const drag = Math.max(0, e.translationY);
      ty.value = drag;
      backdropO.value = Math.max(
        0,
        BACKDROP_FULL * (1 - drag / (sheetHSV.value * 0.55)),
      );
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 650) {
        ty.value = withSpring(sheetHSV.value, SPRING_OUT, () => {
          runOnJS(setModalVisible)(false);
          runOnJS(onClose)();
        });
        backdropO.value = withTiming(0, { duration: 210 });
      } else {
        ty.value = withSpring(0, SPRING_IN);
        backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
      }
    });

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={onModalShow}
      onRequestClose={closeSheet}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
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
            </View>
          </GestureDetector>

          <View style={styles.header}>
            <Text style={[styles.title, { color: ui.accent }]}>ADD AI</Text>
            <Text style={[styles.subtitle, { color: ui.textFaint }]}>
              Seat {seatIndex + 1}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <View style={styles.body}>
            <Text style={[styles.sectionLabel, { color: ui.textFaint }]}>
              DIFFICULTY
            </Text>
            <DifficultyPicker
              value={draftDifficulty}
              onChange={(d) => {
                trigger("selection");
                setDraftDifficulty(d);
              }}
            />
          </View>

          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, lay.s(spacing.lg)),
                borderTopColor: ui.panelBorderSoft,
              },
            ]}
          >
            <MenuButton
              label={confirming ? "ADDING…" : "ADD TO SEAT"}
              variant="primary"
              icon="🤖"
              onPress={handleConfirm}
            />
            <MenuButton
              label="CANCEL"
              variant="ghost"
              onPress={closeSheet}
            />
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  backdrop: { backgroundColor: "rgba(4,14,9,1)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
  },
  handleZone: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.body,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    flex: 1,
  },
  sectionLabel: {
    ...typography.label,
    letterSpacing: 1.5,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
});
