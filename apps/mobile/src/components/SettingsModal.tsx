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
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { colors, radius, spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { AppearancePicker } from "./AppearancePicker";
import { AppIconPicker, isAppIconSupported } from "./AppIconPicker";
import { AccountSection } from "./AccountSection";
import { ConfirmDialog } from "./ConfirmDialog";
import { MenuButton } from "./MenuButton";
import { convexEnabled } from "../game/convexClient";
import { trigger } from "../feedback/haptics";
import { clearAllAppStorage } from "../game/devStorage";
import { formatOnlineMutationError } from "../game/onlineMutationErrors";
import { usePreferencesStore } from "../game/preferencesStore";
import { useGameStore } from "../game/store";
import { MAX_DISPLAY_NAME_LENGTH } from "../game/playerNameStorage";
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
  const lay = useGameLayout();
  const drawerH = Math.min(
    Math.round(screenH * 0.96),
    screenH - insets.top - lay.s(spacing.xs),
  );

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
  const screen = useGameStore((s) => s.screen);
  const playMode = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const onlineIsHost = useGameStore((s) => s.onlineIsHost);
  const serverTurnSeconds = useGameStore((s) => s.turnTimerSeconds);
  const setOnlineStatusMessage = useGameStore((s) => s.setOnlineStatusMessage);
  const applyTurnTimerMidGame = useGameStore((s) => s.applyTurnTimerMidGame);
  const onlineDisplayName = useGameStore((s) => s.onlineDisplayName);
  const setOnlineDisplayName = useGameStore((s) => s.setOnlineDisplayName);
  const setRoomTurnTimer = useMutation(api.rooms.setRoomTurnTimerSeconds);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [wipeConfirmVisible, setWipeConfirmVisible] = useState(false);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    setSound(soundEnabled);
  }, [soundEnabled]);

  const commitDisplayName = useCallback((): boolean => {
    const trimmed = nameDraft.trim();
    if (trimmed) {
      setOnlineDisplayName(trimmed);
      setNameDraft(trimmed);
      setNameError(null);
      return true;
    }
    setNameDraft(onlineDisplayName);
    setNameError("Name cannot be empty");
    return false;
  }, [nameDraft, onlineDisplayName, setOnlineDisplayName]);

  const trimmedNameDraft = nameDraft.trim();
  const nameDirty = trimmedNameDraft !== onlineDisplayName;
  const canSaveName = nameDirty && trimmedNameDraft.length > 0;

  const revertNameDraft = useCallback(() => {
    setNameDraft(onlineDisplayName);
    setNameError(null);
  }, [onlineDisplayName]);

  const handleSaveDisplayName = useCallback(() => {
    if (commitDisplayName()) {
      trigger("confirm");
    } else {
      trigger("error");
    }
  }, [commitDisplayName]);

  const onlineInRoom = playMode === "online" && onlineRoomId != null;
  const canEditTurnTimer = !onlineInRoom || onlineIsHost;
  const effectiveTurnSeconds =
    onlineInRoom ? serverTurnSeconds : turnSeconds;
  const turnTimerHint = !onlineInRoom
    ? screen === "game"
      ? "Applies immediately to the current turn."
      : "Used in solo games and rooms you host."
    : onlineIsHost
      ? "Updates the room timer for everyone."
      : "Only the host can change the timer in online games.";

  const handleTurnTimerPress = useCallback(
    (option: TurnSecondsOption) => {
      if (!canEditTurnTimer || option === effectiveTurnSeconds) return;
      trigger("selection");

      if (onlineInRoom && onlineIsHost && onlineRoomId) {
        usePreferencesStore.getState().setTurnSeconds(option);
        void setRoomTurnTimer({
          roomId: onlineRoomId as Id<"rooms">,
          turnTimerSeconds: option,
        }).catch((error) => {
          setOnlineStatusMessage(formatOnlineMutationError(error));
          trigger("error");
        });
        return;
      }

      applyTurnTimerMidGame(option);
    },
    [
      canEditTurnTimer,
      effectiveTurnSeconds,
      onlineInRoom,
      onlineIsHost,
      onlineRoomId,
      setRoomTurnTimer,
      setOnlineStatusMessage,
      applyTurnTimerMidGame,
    ],
  );

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
    revertNameDraft();
    setModalVisible(false);
    onClose();
  }, [revertNameDraft, onClose]);

  const requestClose = useCallback(() => {
    animateOut(finishClose);
  }, [animateOut, finishClose]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = drawerH; backdropO.value = 0;
      setModalVisible(true);
      setNameDraft(onlineDisplayName);
      setNameError(null);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => {
        setNameDraft(onlineDisplayName);
        setNameError(null);
        setModalVisible(false);
      });
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
                <Text style={[styles.headerSub, { color: ui.textPrimary }]}>
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
              { paddingBottom: Math.max(insets.bottom, lay.s(spacing.lg)) + lay.s(spacing.lg) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionLabel, { color: ui.textPrimary }]}>
              PROFILE
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
              ]}
            >
              <Text style={[styles.profileLabel, { color: ui.textPrimary }]}>
                Display name
              </Text>
              <Text style={[styles.profileHint, { color: ui.textMuted }]}>
                Used in online games. Tap ✓ to save changes.
              </Text>
              <View style={styles.profileInputRow}>
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
                    setNameDraft(t.slice(0, MAX_DISPLAY_NAME_LENGTH));
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Your nickname"
                  placeholderTextColor={ui.textFaint}
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  autoCapitalize="words"
                  returnKeyType="done"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (canSaveName) {
                      handleSaveDisplayName();
                    }
                  }}
                />
                <Pressable
                  style={[
                    styles.nameConfirmBtn,
                    canSaveName
                      ? { backgroundColor: ui.accent, borderColor: ui.accent }
                      : [
                          styles.nameConfirmBtnDisabled,
                          {
                            backgroundColor: ui.feltEdge,
                            borderColor: ui.panelBorderSoft,
                          },
                        ],
                  ]}
                  onPress={handleSaveDisplayName}
                  disabled={!canSaveName}
                  accessibilityRole="button"
                  accessibilityLabel="Save display name"
                  accessibilityState={{ disabled: !canSaveName }}
                >
                  <Text
                    style={[
                      styles.nameConfirmText,
                      { color: canSaveName ? ui.badgeText : ui.textFaint },
                    ]}
                  >
                    ✓
                  </Text>
                </Pressable>
              </View>
              {nameError && (
                <Text style={[styles.nameError, { color: colors.danger }]}>
                  {nameError}
                </Text>
              )}
            </View>

            {convexEnabled && <AccountSection />}

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textPrimary }]}>
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

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textPrimary }]}>
              GAMEPLAY
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
              ]}
            >
              <Text style={[styles.optionLabel, { color: ui.textPrimary }]}>Turn timer</Text>
              <Text style={[styles.optionHint, { color: ui.textMuted }]}>
                {turnTimerHint}
              </Text>
              <View style={[styles.turnRow, !canEditTurnTimer && styles.turnRowDisabled]}>
                {TURN_SECONDS_OPTIONS.map((option) => {
                  const active = effectiveTurnSeconds === option;
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
                      onPress={() => handleTurnTimerPress(option)}
                      disabled={!canEditTurnTimer}
                      accessibilityState={{ disabled: !canEditTurnTimer }}
                    >
                      <Text
                        style={[
                          styles.turnChipText,
                          { color: active ? ui.accent : ui.textPrimary },
                        ]}
                      >
                        {turnSecondsLabel(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textPrimary }]}>
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

            {isAppIconSupported && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textPrimary }]}>
                  APP ICON
                </Text>
                <View
                  style={[
                    styles.cardDesignPanel,
                    { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
                  ]}
                >
                  <AppIconPicker />
                </View>
              </>
            )}

            {__DEV__ && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.xl, color: ui.textPrimary }]}>
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
    ...typography.heading,
    fontWeight: "800",
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
    color: "rgba(255, 255, 255, 0.6)",
  },
  profileInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  profileInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  nameConfirmBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.panel,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nameConfirmBtnDisabled: {
    opacity: 0.55,
  },
  nameConfirmText: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
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
  rowLabel: { ...typography.heading, fontWeight: "800" },
  rowDivider: {
    height: 1,
    marginHorizontal: spacing.md,
  },
  optionLabel: {
    ...typography.heading,
    fontWeight: "800",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  optionHint: {
    ...typography.caption,
    fontWeight: "500",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    lineHeight: 20,
  },
  turnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  turnRowDisabled: {
    opacity: 0.55,
  },
  turnChip: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 54,
    justifyContent: "center",
  },
  turnChipText: {
    ...typography.heading,
    fontWeight: "800",
  },
  version: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
});
