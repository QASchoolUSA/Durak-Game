import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { radius, spacing, typography } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { AppearancePicker } from "./AppearancePicker";
import { trigger } from "../feedback/haptics";
import { usePreferencesStore } from "../game/preferencesStore";
import {
  TURN_SECONDS_OPTIONS,
  turnSecondsLabel,
  type TurnSecondsOption,
} from "../game/turnTimerStorage";

const SPRING_IN  = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;
const DRAWER_HEIGHT_RATIO = 0.68;

export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const { height: screenH } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  const drawerH = Math.round(screenH * DRAWER_HEIGHT_RATIO);

  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];

  const [sound, setSound] = useState(true);
  const hapticsEnabled = usePreferencesStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = usePreferencesStore((s) => s.setHapticsEnabled);
  const soundEnabled = usePreferencesStore((s) => s.soundEnabled);
  const setSoundEnabled = usePreferencesStore((s) => s.setSoundEnabled);
  const turnSeconds = usePreferencesStore((s) => s.turnSeconds);
  const setTurnSeconds = usePreferencesStore((s) => s.setTurnSeconds);

  useEffect(() => {
    setSound(soundEnabled);
  }, [soundEnabled]);

  const handleSoundToggle = useCallback(
    (enabled: boolean) => {
      setSound(enabled);
      setSoundEnabled(enabled);
      if (enabled) trigger("uiTap");
    },
    [setSoundEnabled],
  );
  const handleHapticsToggle = useCallback(
    (enabled: boolean) => {
      setHapticsEnabled(enabled);
      if (enabled) trigger("uiTap");
    },
    [setHapticsEnabled],
  );

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

  const handleClose = useCallback(() => {
    animateOut(() => { setModalVisible(false); onClose(); });
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
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
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
                <Text style={[styles.title, { color: ui.accent }]}>SETTINGS</Text>
                <Text style={[styles.headerSub, { color: ui.textFaint }]}>
                  Swipe down to close
                </Text>
              </View>
            </View>
          </GestureDetector>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionLabel, { color: ui.textFaint }]}>
              AUDIO & FEEDBACK
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
              ]}
            >
              <Row label="Sound Effects" value={sound} onToggle={handleSoundToggle} />
              <View style={[styles.rowDivider, { backgroundColor: ui.panelBorderSoft }]} />
              <Row label="Haptic Feedback" value={hapticsEnabled} onToggle={handleHapticsToggle} />
            </View>

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textFaint }]}>
              GAMEPLAY
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
              ]}
            >
              <Text style={[styles.optionLabel, { color: ui.textPrimary }]}>Turn timer</Text>
              <View style={styles.turnRow}>
                {TURN_SECONDS_OPTIONS.map((option) => {
                  const active = turnSeconds === option;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.turnChip,
                        {
                          borderColor: active ? ui.accent : ui.panelBorderSoft,
                          backgroundColor: active ? ui.accentSoft : ui.feltEdge,
                        },
                      ]}
                      onPress={() => {
                        trigger("selection");
                        setTurnSeconds(option as TurnSecondsOption);
                      }}
                    >
                      <Text
                        style={[
                          styles.turnChipText,
                          { color: active ? ui.accent : ui.textMuted },
                        ]}
                      >
                        {turnSecondsLabel(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textFaint }]}>
              APPEARANCE
            </Text>
            <View
              style={[
                styles.cardDesignPanel,
                { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
              ]}
            >
              <AppearancePicker />
            </View>

            <Text style={[styles.version, { color: ui.textFaint }]}>
              Durak · v1.0 · Classic Russian Card Game
            </Text>
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Row({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  const ui = useUiTheme();

  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.rowLabel, { color: ui.textPrimary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: ui.feltEdge, true: ui.accentMuted }}
        thumbColor={value ? ui.accent : ui.textFaint}
        ios_backgroundColor={ui.feltEdge}
      />
    </View>
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
  },

  scroll:  { flex: 1 },
  content: { padding: spacing.lg },
  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  card: {
    borderRadius: radius.panel,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardDesignPanel: {
    borderRadius: radius.panel,
    borderWidth: 1,
    padding: spacing.md,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLabel: { ...typography.body },
  rowDivider: {
    height: 1,
    marginHorizontal: spacing.md,
  },
  optionLabel: {
    ...typography.body,
    fontWeight: "700",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  turnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  turnChip: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  turnChipText: {
    ...typography.caption,
    fontWeight: "800",
  },
  version: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
});
