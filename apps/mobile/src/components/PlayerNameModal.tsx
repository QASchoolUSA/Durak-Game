import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInput as TextInputType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { MenuButton } from "./MenuButton";
import { trigger } from "../feedback/haptics";
import { useGameStore } from "../game/store";
import { colors, radius, spacing, typography } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";

const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const BACKDROP_FULL = 0.76;
const DRAWER_HEIGHT_RATIO = 0.52;
const FOCUS_MARGIN = 12;
const MAX_SHEET_LIFT = 200;

function capSheetLift(lift: number, keyboardHeight: number): number {
  if (lift <= 0) return 0;
  return Math.min(lift, MAX_SHEET_LIFT, keyboardHeight * 0.55);
}

export interface PlayerNameModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function PlayerNameModal({ visible, onComplete }: PlayerNameModalProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerH = Math.round(screenH * DRAWER_HEIGHT_RATIO);

  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];

  const setOnlineDisplayName = useGameStore((s) => s.setOnlineDisplayName);

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);
  const scrollRef = useRef<ScrollView>(null);
  const nameInputRef = useRef<TextInputType>(null);
  const scrollYRef = useRef(0);
  const inputFocusedRef = useRef(false);
  const keyboardHeightRef = useRef(0);
  const adjustTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remeasureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ty = useSharedValue(drawerH);
  const keyboardLift = useSharedValue(0);
  const backdropO = useSharedValue(0);

  const clearAdjustTimeouts = useCallback(() => {
    if (adjustTimeoutRef.current) {
      clearTimeout(adjustTimeoutRef.current);
      adjustTimeoutRef.current = null;
    }
    if (remeasureTimeoutRef.current) {
      clearTimeout(remeasureTimeoutRef.current);
      remeasureTimeoutRef.current = null;
    }
  }, []);

  const resetKeyboardLift = useCallback(() => {
    clearAdjustTimeouts();
    keyboardLift.value = 0;
    keyboardHeightRef.current = 0;
    inputFocusedRef.current = false;
  }, [keyboardLift, clearAdjustTimeouts]);

  const applyKeyboardAdjustment = useCallback(
    (kbHeight: number, duration = 250) => {
      if (!inputFocusedRef.current || kbHeight <= 0) {
        keyboardLift.value = withTiming(0, { duration });
        return;
      }

      const visibleBottom = screenH - kbHeight - FOCUS_MARGIN;

      const measureAndAdjust = () => {
        const input = nameInputRef.current;
        if (!input) return;

        input.measureInWindow((_x, y, _w, h) => {
          const overflow = Math.max(0, y + h - visibleBottom);

          if (overflow <= 0) {
            keyboardLift.value = withTiming(0, { duration });
            return;
          }

          const nextScrollY = scrollYRef.current + overflow;
          scrollRef.current?.scrollTo({ y: nextScrollY, animated: true });
          scrollYRef.current = nextScrollY;

          if (remeasureTimeoutRef.current) {
            clearTimeout(remeasureTimeoutRef.current);
          }
          remeasureTimeoutRef.current = setTimeout(() => {
            input.measureInWindow((_x2, y2, _w2, h2) => {
              const remaining = Math.max(0, y2 + h2 - visibleBottom);
              const lift = capSheetLift(remaining, kbHeight);
              keyboardLift.value = withTiming(-lift, { duration });
            });
          }, Platform.OS === "ios" ? 120 : 80);
        });
      };

      clearAdjustTimeouts();
      adjustTimeoutRef.current = setTimeout(
        measureAndAdjust,
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
      keyboardHeightRef.current = height;
      const duration = "duration" in e && e.duration ? e.duration : 250;
      applyKeyboardAdjustment(height, duration);
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      keyboardHeightRef.current = 0;
      inputFocusedRef.current = false;
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

  const handleNameFocus = useCallback(() => {
    inputFocusedRef.current = true;
    const kb = keyboardHeightRef.current;
    if (kb > 0) {
      applyKeyboardAdjustment(kb, 250);
      return;
    }
    clearAdjustTimeouts();
    adjustTimeoutRef.current = setTimeout(() => {
      const height = keyboardHeightRef.current;
      if (height > 0 && inputFocusedRef.current) {
        applyKeyboardAdjustment(height, 250);
      }
    }, Platform.OS === "ios" ? 320 : 120);
  }, [applyKeyboardAdjustment, clearAdjustTimeouts]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = drawerH;
      keyboardLift.value = 0;
      backdropO.value = 0;
      setModalVisible(true);
      setName("");
      setError(null);
      scrollYRef.current = 0;
    }
    if (!visible && prevVisible.current) {
      Keyboard.dismiss();
      resetKeyboardLift();
    }
    prevVisible.current = visible;
  }, [visible, drawerH, ty, backdropO, keyboardLift, resetKeyboardLift]);

  const onModalShow = useCallback(() => {
    keyboardLift.value = 0;
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO, keyboardLift]);

  const handleContinue = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name to continue");
      trigger("error");
      return;
    }
    Keyboard.dismiss();
    resetKeyboardLift();
    setOnlineDisplayName(trimmed);
    trigger("confirm");
    setModalVisible(false);
    onComplete();
  }, [name, setOnlineDisplayName, onComplete, resetKeyboardLift]);

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
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]} />

        <Animated.View style={[styles.sheet, { height: drawerH }, aSheet]}>
          <LinearGradient
            colors={sheetGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={[styles.topAccent, { backgroundColor: ui.panelBorder }]} />

          <View style={styles.topBar}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: ui.accentMuted }]} />
            </View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: ui.accent }]}>WELCOME</Text>
              <Text style={[styles.headerSub, { color: ui.textFaint }]}>
                Choose a name for online games
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.body,
              { paddingBottom: scrollPaddingBottom },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => {
              scrollYRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <Text style={[styles.label, { color: ui.textFaint }]}>YOUR NAME</Text>
            <TextInput
              ref={nameInputRef}
              style={[
                styles.input,
                {
                  color: ui.textPrimary,
                  borderColor: ui.panelBorderSoft,
                  backgroundColor: ui.panelBg,
                },
              ]}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError(null);
              }}
              placeholder="Nickname"
              placeholderTextColor={ui.textFaint}
              maxLength={20}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleContinue}
              onFocus={handleNameFocus}
            />

            {error && (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            )}

            <MenuButton
              label="CONTINUE"
              variant="primary"
              icon="▶"
              onPress={handleContinue}
            />
          </ScrollView>
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
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  error: {
    ...typography.caption,
    textAlign: "center",
  },
});
