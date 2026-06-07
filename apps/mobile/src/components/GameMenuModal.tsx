import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
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
import { colors, radius, spacing, typography } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { trigger } from "../feedback/haptics";

const SPRING_IN  = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

export interface GameMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onLeaveGame: () => void;
}

export function GameMenuModal({
  visible,
  onClose,
  onOpenSettings,
  onLeaveGame,
}: GameMenuModalProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const { height: screenH } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  
  const drawerH = 360 + insets.bottom;

  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);

  const ty        = useSharedValue(drawerH);
  const backdropO = useSharedValue(0);
  const drawerHSV = useSharedValue(drawerH);
  useEffect(() => { drawerHSV.value = drawerH; }, [drawerH, drawerHSV]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value        = withSpring(drawerH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [drawerH, ty, backdropO],
  );

  const requestClose = useCallback(() => {
    animateOut(() => {
      setModalVisible(false);
      onClose();
    });
  }, [animateOut, onClose]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = drawerH; backdropO.value = 0;
      setModalVisible(true);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, drawerH, modalVisible, ty, backdropO, animateOut]);

  const onModalShow = useCallback(() => {
    ty.value        = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO]);

  const swipeDown = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-22, 22])
    .onUpdate((e) => {
      const drag = Math.max(0, e.translationY);
      ty.value = drag;
      backdropO.value = Math.max(0, BACKDROP_FULL * (1 - drag / (drawerHSV.value * 0.55)));
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 650) {
        ty.value = withSpring(drawerHSV.value, SPRING_OUT, () => {
          runOnJS(setModalVisible)(false);
          runOnJS(onClose)();
        });
        backdropO.value = withTiming(0, { duration: 210 });
      } else {
        ty.value        = withSpring(0, SPRING_IN);
        backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
      }
    });

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet    = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

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

        <Animated.View style={[styles.sheet, { height: drawerH }, aSheet]}>
          <LinearGradient
            colors={sheetGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={[styles.topAccent, { backgroundColor: ui.panelBorder }]} />

          <GestureDetector gesture={swipeDown}>
            <View style={styles.topBar}>
              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: ui.accentMuted }]} />
              </View>
              <View style={styles.header}>
                <Text style={[styles.title, { color: ui.accent }]}>GAME MENU</Text>
                <Text style={[styles.headerSub, { color: ui.textPrimary }]}>
                  Swipe down to close
                </Text>
              </View>
            </View>
          </GestureDetector>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
                pressed && { backgroundColor: ui.accentSoft }
              ]}
              onPress={() => {
                trigger("uiTap");
                animateOut(() => {
                  setModalVisible(false);
                  onOpenSettings();
                });
              }}
            >
              <View style={[styles.iconWrap, { backgroundColor: ui.accentMuted }]}>
                <Text style={[styles.icon, { color: ui.accent }]}>⚙</Text>
              </View>
              <Text style={[styles.btnText, { color: ui.textPrimary }]}>Settings</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
                pressed && { backgroundColor: ui.accentSoft }
              ]}
              onPress={() => {
                trigger("confirm");
                animateOut(() => {
                  setModalVisible(false);
                  onLeaveGame();
                });
              }}
            >
              <View style={[styles.iconWrap, { backgroundColor: ui.accentMuted }]}>
                <Text style={[styles.icon, { color: ui.accent }]}>✕</Text>
              </View>
              <Text style={[styles.btnText, { color: ui.textPrimary }]}>Leave Game</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                { backgroundColor: ui.feltEdge, borderColor: ui.panelBorderSoft },
                pressed && { opacity: 0.7 }
              ]}
              onPress={() => {
                trigger("uiTap");
                requestClose();
              }}
            >
              <Text style={[styles.cancelText, { color: ui.textPrimary }]}>Cancel</Text>
            </Pressable>
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
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    flexDirection: "column",
  },
  topAccent: {
    position: "absolute", top: 0, left: 44, right: 44,
    height: 1, borderRadius: 1,
  },

  topBar: {},
  handleWrap: { alignItems: "center", paddingTop: 14, paddingBottom: 8 },
  handle:     { width: 40, height: 4, borderRadius: 2 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xs,
    paddingBottom:     spacing.sm,
  },
  title:     { ...typography.title, letterSpacing: 3 },
  headerSub: { ...typography.caption, marginTop: 3, letterSpacing: 0.4 },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  content: { 
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.panel,
    borderWidth: 1,
    gap: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 18,
    fontWeight: "700",
  },
  btnText: {
    ...typography.body,
    fontWeight: "700",
    fontSize: 16,
  },
  cancelBtn: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelText: {
    ...typography.body,
    fontWeight: "700",
    fontSize: 16,
  },
});
