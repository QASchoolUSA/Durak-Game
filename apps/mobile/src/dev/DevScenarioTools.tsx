import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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
import { DEBUG_SCENARIOS, type DevScenarioId } from "./debugScenarios";
import { useGameStore } from "../game/store";
import { trigger } from "../feedback/haptics";
import { radius, spacing, typography } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";

const FAB_WIDTH = 52;
const FAB_HEIGHT = 32;
const SHEET_BODY_HEIGHT = 340;
const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

function DevScenarioDrawer({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: DevScenarioId) => void;
}) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const insets = useSafeAreaInsets();
  const sheetH = SHEET_BODY_HEIGHT + insets.bottom;

  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    ui.feltEdge,
  ];

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);

  const ty = useSharedValue(sheetH);
  const backdropO = useSharedValue(0);
  const sheetHSV = useSharedValue(sheetH);

  useEffect(() => {
    sheetHSV.value = sheetH;
  }, [sheetH, sheetHSV]);

  const finishClose = useCallback(() => {
    setModalVisible(false);
    onClose();
  }, [onClose]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value = withSpring(sheetH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [sheetH, ty, backdropO],
  );

  const requestClose = useCallback(() => {
    animateOut(finishClose);
  }, [animateOut, finishClose]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = sheetH;
      backdropO.value = 0;
      setModalVisible(true);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, sheetH, modalVisible, ty, backdropO, animateOut]);

  const onModalShow = useCallback(() => {
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO]);

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
          runOnJS(finishClose)();
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
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { height: sheetH, borderColor: ui.accentMuted },
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
              <Text style={[styles.sheetTitle, { color: ui.accent }]}>DEV SCENARIOS</Text>
              <Text style={[styles.sheetSub, { color: ui.textFaint }]}>
                Swipe down to close
              </Text>
            </View>
          </GestureDetector>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            {DEBUG_SCENARIOS.map((scenario) => (
              <Pressable
                key={scenario.id}
                style={({ pressed }) => [
                  styles.scenarioRow,
                  {
                    backgroundColor: ui.panelBg,
                    borderColor: ui.panelBorderSoft,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => {
                  trigger("confirm");
                  onSelect(scenario.id);
                  requestClose();
                }}
              >
                <Text style={[styles.scenarioTitle, { color: ui.textPrimary }]}>
                  {scenario.title}
                </Text>
                <Text style={[styles.scenarioDesc, { color: ui.textMuted }]}>
                  {scenario.description}
                </Text>
              </Pressable>
            ))}
            <Text style={[styles.footer, { color: ui.textFaint }]}>Dev builds only</Text>
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Dev-only draggable FAB that opens preset game scenarios for QA. */
export function DevScenarioTools() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const loadDevScenario = useGameStore((s) => s.loadDevScenario);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const posX = useSharedValue(Math.max(0, width - FAB_WIDTH - 12));
  const posY = useSharedValue(insets.top + 56);
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  useEffect(() => {
    posX.value = Math.max(0, width - FAB_WIDTH - 12);
    posY.value = insets.top + 56;
  }, [width, insets.top, posX, posY]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(openDrawer)();
  });

  const pan = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      dragStartX.value = posX.value;
      dragStartY.value = posY.value;
    })
    .onUpdate((e) => {
      const minX = 8;
      const maxX = Math.max(minX, width - FAB_WIDTH - 8);
      const minY = insets.top + 8;
      const maxY = Math.max(minY, height - FAB_HEIGHT - insets.bottom - 8);
      posX.value = clamp(dragStartX.value + e.translationX, minX, maxX);
      posY.value = clamp(dragStartY.value + e.translationY, minY, maxY);
    });

  const fabGesture = Gesture.Exclusive(pan, tap);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: posX.value }, { translateY: posY.value }],
  }));

  const handleSelect = useCallback(
    (id: DevScenarioId) => {
      loadDevScenario(id);
    },
    [loadDevScenario],
  );

  if (!__DEV__) return null;

  return (
    <>
      <GestureDetector gesture={fabGesture}>
        <Animated.View
          style={[styles.fab, fabStyle]}
          accessibilityLabel="Open dev scenarios"
        >
          <Text style={styles.fabText}>DEV</Text>
        </Animated.View>
      </GestureDetector>

      <DevScenarioDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelect={handleSelect}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    top: 0,
    left: 0,
    width: FAB_WIDTH,
    height: FAB_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1,
    borderColor: "rgba(124,255,178,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    elevation: 99999,
  },
  fabText: {
    color: "#7CFFB2",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  gestureRoot: { flex: 1 },
  backdrop: { backgroundColor: "#000" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    borderWidth: 1,
    overflow: "hidden",
  },
  handleZone: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetTitle: {
    ...typography.label,
    letterSpacing: 1.2,
  },
  sheetSub: {
    ...typography.caption,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  scenarioRow: {
    borderRadius: radius.panel,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  scenarioTitle: {
    ...typography.body,
    fontWeight: "700",
  },
  scenarioDesc: {
    ...typography.caption,
    lineHeight: 18,
  },
  footer: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
