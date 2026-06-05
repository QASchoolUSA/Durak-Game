import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInput as TextInputType,
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
import { MenuButton } from "./MenuButton";
import { trigger } from "../feedback/haptics";
import { saveRoomSession } from "../game/onlineSessionStorage";
import { useGameStore } from "../game/store";
import { colors, radius, spacing, typography } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";

const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;
const DRAWER_HEIGHT_RATIO = 0.48;
const ROOM_CODE_ACCESSORY_ID = "joinRoomCodeAccessory";

/** Space between bottom of join button and top of keyboard accessory bar */
const KEYBOARD_BUTTON_GAP = 18;
/** iOS InputAccessoryView toolbar above number pad */
const ACCESSORY_BAR_HEIGHT = 44;
/** Extra lift beyond measured overflow for the compact drawer */
const EXTRA_SHEET_LIFT = 6;
/** Safety cap so a bad measure never launches the sheet off-screen */
const MAX_SHEET_LIFT = 220;

type FocusedField = "code";

function capSheetLift(lift: number, keyboardHeight: number): number {
  if (lift <= 0) return 0;
  return Math.min(lift + EXTRA_SHEET_LIFT, MAX_SHEET_LIFT, keyboardHeight * 0.65);
}

export interface OnlineJoinDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function OnlineJoinDrawer({ visible, onClose }: OnlineJoinDrawerProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerH = Math.round(screenH * DRAWER_HEIGHT_RATIO);

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);
  const scrollRef = useRef<ScrollView>(null);
  const codeInputRef = useRef<TextInputType>(null);
  const joinButtonRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const focusedFieldRef = useRef<FocusedField | null>(null);
  const keyboardHeightRef = useRef(0);
  const keyboardAdjustedRef = useRef(false);
  const adjustTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinRoom = useMutation(api.rooms.joinRoom);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);

  const ty = useSharedValue(drawerH);
  const keyboardLift = useSharedValue(0);
  const backdropO = useSharedValue(0);
  const drawerHSV = useSharedValue(drawerH);
  useEffect(() => { drawerHSV.value = drawerH; }, [drawerH, drawerHSV]);

  const clearAdjustTimeouts = useCallback(() => {
    if (adjustTimeoutRef.current) {
      clearTimeout(adjustTimeoutRef.current);
      adjustTimeoutRef.current = null;
    }
  }, []);

  const resetKeyboardLift = useCallback(() => {
    clearAdjustTimeouts();
    keyboardLift.value = 0;
    keyboardHeightRef.current = 0;
    keyboardAdjustedRef.current = false;
    focusedFieldRef.current = null;
    scrollYRef.current = 0;
  }, [keyboardLift, clearAdjustTimeouts]);

  const applyKeyboardAdjustment = useCallback(
    (kbHeight: number, duration = 250) => {
      if (!focusedFieldRef.current || kbHeight <= 0) return;
      if (keyboardAdjustedRef.current) return;

      const visibleBottom =
        screenH - kbHeight - ACCESSORY_BAR_HEIGHT - KEYBOARD_BUTTON_GAP;

      const runAdjustment = () => {
        const target = joinButtonRef.current ?? codeInputRef.current;
        if (!target) return;

        target.measureInWindow((_x, y, _w, h) => {
          const overflow = Math.max(0, y + h - visibleBottom);
          if (overflow <= 0) return;

          keyboardAdjustedRef.current = true;

          if (overflow > 0) {
            const nextScrollY = scrollYRef.current + overflow;
            scrollRef.current?.scrollTo({ y: nextScrollY, animated: false });
            scrollYRef.current = nextScrollY;
          }

          const lift = capSheetLift(overflow, kbHeight);
          keyboardLift.value = withTiming(-lift, { duration });
        });
      };

      clearAdjustTimeouts();
      adjustTimeoutRef.current = setTimeout(
        runAdjustment,
        Platform.OS === "ios" ? 50 : 16,
      );
    },
    [screenH, keyboardLift, clearAdjustTimeouts],
  );

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates.height;
      const prevHeight = keyboardHeightRef.current;
      keyboardHeightRef.current = height;
      if (
        keyboardAdjustedRef.current &&
        Math.abs(height - prevHeight) < 8
      ) {
        return;
      }
      const duration = "duration" in e && e.duration ? e.duration : 250;
      applyKeyboardAdjustment(height, duration);
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      keyboardHeightRef.current = 0;
      focusedFieldRef.current = null;
      clearAdjustTimeouts();
      const duration = "duration" in e && e.duration ? e.duration : 250;
      keyboardLift.value =
        Platform.OS === "ios"
          ? withTiming(0, { duration })
          : withSpring(0, SPRING_IN);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      clearAdjustTimeouts();
    };
  }, [keyboardLift, applyKeyboardAdjustment, clearAdjustTimeouts]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleCodeFocus = useCallback(() => {
    focusedFieldRef.current = "code";
    if (keyboardAdjustedRef.current) return;
    const kb = keyboardHeightRef.current;
    if (kb > 0) {
      applyKeyboardAdjustment(kb, 250);
      return;
    }
    clearAdjustTimeouts();
    adjustTimeoutRef.current = setTimeout(() => {
      const height = keyboardHeightRef.current;
      if (
        height > 0 &&
        focusedFieldRef.current === "code" &&
        !keyboardAdjustedRef.current
      ) {
        applyKeyboardAdjustment(height, 250);
      }
    }, Platform.OS === "ios" ? 320 : 120);
  }, [applyKeyboardAdjustment, clearAdjustTimeouts]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      keyboardLift.value = 0;
      ty.value = withSpring(drawerH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [drawerH, ty, backdropO, keyboardLift],
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    resetKeyboardLift();
    animateOut(() => { setModalVisible(false); onClose(); });
  }, [animateOut, onClose, resetKeyboardLift]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = drawerH;
      keyboardLift.value = 0;
      backdropO.value = 0;
      setModalVisible(true);
      setError(null);
      keyboardAdjustedRef.current = false;
      scrollYRef.current = 0;
    }
    if (!visible && prevVisible.current && modalVisible) {
      Keyboard.dismiss();
      resetKeyboardLift();
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, drawerH, modalVisible, ty, backdropO, animateOut, keyboardLift, resetKeyboardLift]);

  const onModalShow = useCallback(() => {
    keyboardLift.value = 0;
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO, keyboardLift]);

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
        runOnJS(dismissKeyboard)();
        runOnJS(resetKeyboardLift)();
        ty.value = withSpring(drawerHSV.value, SPRING_OUT, () => {
          runOnJS(setModalVisible)(false);
          runOnJS(onClose)();
        });
        backdropO.value = withTiming(0, { duration: 210 });
      } else {
        ty.value = withSpring(0, SPRING_IN);
        backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
      }
    });

  const handleJoin = useCallback(async () => {
    const trimmedCode = code.replace(/\D/g, "").slice(0, 6);
    const name = useGameStore.getState().onlineDisplayName.trim() || "Player";
    if (trimmedCode.length !== 6) {
      setError("Enter a 6-digit room code");
      return;
    }
    Keyboard.dismiss();
    resetKeyboardLift();
    setJoining(true);
    setError(null);
    try {
      const result = await joinRoom({ code: trimmedCode, displayName: name });
      await saveRoomSession({
        roomId: result.roomId,
        sessionToken: result.sessionToken,
        displayName: name,
      });
      trigger("gameStart");
      enterOnlineLobby({
        roomId: result.roomId,
        sessionToken: result.sessionToken,
        displayName: name,
        code: trimmedCode,
        isHost: false,
      });
      setModalVisible(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join room");
      trigger("error");
    } finally {
      setJoining(false);
    }
  }, [code, joinRoom, enterOnlineLobby, onClose, resetKeyboardLift]);

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value + keyboardLift.value }],
  }));

  const scrollPaddingBottom = Math.max(insets.bottom, spacing.lg) + spacing.lg;

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
                <Text style={[styles.title, { color: ui.accent }]}>JOIN GAME</Text>
                <Text style={[styles.headerSub, { color: ui.textFaint }]}>
                  Swipe down to close
                </Text>
              </View>
            </View>
          </GestureDetector>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: scrollPaddingBottom },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => {
              scrollYRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <Text style={[styles.sub, { color: ui.textFaint }]}>
              Enter the room code from your friend
            </Text>

            <Text style={[styles.label, { color: ui.textFaint }]}>ROOM CODE</Text>
            <TextInput
              ref={codeInputRef}
              style={[
                styles.input,
                styles.codeInput,
                {
                  color: ui.accent,
                  borderColor: ui.accent,
                  backgroundColor: ui.panelBg,
                },
              ]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={ui.textFaint}
              keyboardType="number-pad"
              maxLength={6}
              inputAccessoryViewID={
                Platform.OS === "ios" ? ROOM_CODE_ACCESSORY_ID : undefined
              }
              onFocus={handleCodeFocus}
            />

            {error && (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            )}

            <View ref={joinButtonRef} collapsable={false}>
              <MenuButton
                label={joining ? "JOINING…" : "JOIN ROOM"}
                variant="primary"
                icon="▶"
                onPress={handleJoin}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>

      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={ROOM_CODE_ACCESSORY_ID}>
          <View
            style={[
              styles.accessoryBar,
              {
                borderTopColor: ui.panelBorderSoft,
                backgroundColor: ui.panelBg,
              },
            ]}
          >
            <Pressable
              style={styles.accessoryDone}
              onPress={dismissKeyboard}
              hitSlop={8}
            >
              <Text style={[styles.accessoryDoneText, { color: ui.accent }]}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
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
    flexDirection: "column",
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 44,
    right: 44,
    height: 1,
    borderRadius: 1,
  },

  topBar: {},
  handleWrap: { alignItems: "center", paddingTop: 14, paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.title, letterSpacing: 3 },
  headerSub: { ...typography.caption, marginTop: 3, letterSpacing: 0.4 },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },

  scroll: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sub: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
  },
  error: {
    ...typography.caption,
    textAlign: "center",
  },

  accessoryBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  accessoryDone: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  accessoryDoneText: {
    ...typography.body,
    fontWeight: "700",
    fontSize: 17,
  },
});
