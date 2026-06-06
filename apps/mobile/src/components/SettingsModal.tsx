import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
import { AppearancePicker } from "./AppearancePicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { MenuButton } from "./MenuButton";
import { trigger } from "../feedback/haptics";
import { clearAllAppStorage } from "../game/devStorage";
import { usePreferencesStore } from "../game/preferencesStore";
import { useGameStore } from "../game/store";
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
  const playMode = useGameStore((s) => s.playMode);
  const onlineDisplayName = useGameStore((s) => s.onlineDisplayName);
  const setOnlineDisplayName = useGameStore((s) => s.setOnlineDisplayName);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [wipeConfirmVisible, setWipeConfirmVisible] = useState(false);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    setSound(soundEnabled);
  }, [soundEnabled]);

  const commitDisplayName = useCallback(() => {
    const trimmed = nameDraft.trim();
    if (trimmed) {
      setOnlineDisplayName(trimmed);
      setNameDraft(trimmed);
      setNameError(null);
      return;
    }
    setNameDraft(onlineDisplayName);
    setNameError("Name cannot be empty");
  }, [nameDraft, onlineDisplayName, setOnlineDisplayName]);

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

  const handleConfirmWipe = useCallback(async () => {
    setWipeConfirmVisible(false);
    setWiping(true);
    try {
      await clearAllAppStorage();
      const { onlineDisplayName: name, soundEnabled: soundOn } = {
        onlineDisplayName: useGameStore.getState().onlineDisplayName,
        soundEnabled: usePreferencesStore.getState().soundEnabled,
      };
      setNameDraft(name);
      setNameError(null);
      setSound(soundOn);
      trigger("confirm");
    } catch {
      trigger("error");
    } finally {
      setWiping(false);
    }
  }, []);

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

  const finishClose = useCallback(() => {
    commitDisplayName();
    setModalVisible(false);
    onClose();
  }, [commitDisplayName, onClose]);

  const requestClose = useCallback(() => {
    commitDisplayName();
    animateOut(finishClose);
  }, [commitDisplayName, animateOut, finishClose]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = drawerH; backdropO.value = 0;
      setModalVisible(true);
      setNameDraft(onlineDisplayName);
      setNameError(null);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, drawerH, modalVisible, ty, backdropO, animateOut, onlineDisplayName]);

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
          runOnJS(finishClose)();
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
              PROFILE
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
              ]}
            >
              <Text style={[styles.profileLabel, { color: ui.textFaint }]}>
                Display name
              </Text>
              <Text style={[styles.profileHint, { color: ui.textFaint }]}>
                Used in online games. Change anytime.
              </Text>
              <TextInput
                style={[
                  styles.profileInput,
                  {
                    color: ui.textPrimary,
                    borderColor: ui.panelBorderSoft,
                    backgroundColor: ui.feltEdge,
                  },
                ]}
                value={nameDraft}
                onChangeText={(t) => {
                  setNameDraft(t.slice(0, 20));
                  if (nameError) setNameError(null);
                }}
                onEndEditing={commitDisplayName}
                placeholder="Your nickname"
                placeholderTextColor={ui.textFaint}
                maxLength={20}
                autoCapitalize="words"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={commitDisplayName}
              />
              {nameError && (
                <Text style={[styles.nameError, { color: colors.danger }]}>
                  {nameError}
                </Text>
              )}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textFaint }]}>
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
              {playMode === "online" ? (
                <Text style={[styles.optionHint, { color: ui.textMuted }]}>
                  Turn timer is set by the server (12 seconds per turn) during online games.
                </Text>
              ) : (
                <>
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
                </>
              )}
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

            {__DEV__ && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textFaint }]}>
                  TESTING
                </Text>
                <View
                  style={[
                    styles.card,
                    styles.devCard,
                    { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
                  ]}
                >
                  <Text style={[styles.devHint, { color: ui.textFaint }]}>
                    Clears AsyncStorage and reloads defaults (new guest name, settings reset).
                  </Text>
                  <MenuButton
                    label={wiping ? "CLEARING…" : "CLEAR SAVED DATA"}
                    variant="ghost"
                    onPress={() => setWipeConfirmVisible(true)}
                  />
                </View>
              </>
            )}

            <Text style={[styles.version, { color: ui.textFaint }]}>
              Durak · v1.0 · Classic Russian Card Game
            </Text>
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>

      <ConfirmDialog
        visible={wipeConfirmVisible}
        title="Clear saved data?"
        message="This clears your name, settings, and saved session. Your online account stays signed in. You cannot undo this."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        onConfirm={() => void handleConfirmWipe()}
        onCancel={() => setWipeConfirmVisible(false)}
      />
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
  profileLabel: {
    ...typography.caption,
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  profileHint: {
    ...typography.caption,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  devCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  devHint: {
    ...typography.caption,
    textAlign: "center",
  },
  profileInput: {
    borderWidth: 1,
    borderRadius: radius.panel,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  nameError: {
    ...typography.caption,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
  optionHint: {
    ...typography.caption,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    lineHeight: 20,
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
