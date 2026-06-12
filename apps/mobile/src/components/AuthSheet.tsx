import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MenuButton } from "./MenuButton";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameStore } from "../game/store";
import { trigger } from "../feedback/haptics";
import { colors, radius, spacing, typography } from "../theme";

const SPRING_IN  = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
// Softer than the main drawers: this sheet often stacks above an already
// dimmed drawer (Settings, Friends), so a full 0.76 would double-darken.
const BACKDROP_FULL = 0.6;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const AUTH_ACCESSORY_ID = "authSheetAccessory";
/** Space between the bottom of the submit button and the top of the keyboard accessory */
const KEYBOARD_BUTTON_GAP = 18;
/** Height of the iOS InputAccessoryView toolbar */
const ACCESSORY_BAR_HEIGHT = 44;
/** Extra lift beyond measured overflow */
const EXTRA_SHEET_LIFT = 6;
/** Safety cap so a bad measure never launches the sheet off-screen */
const MAX_SHEET_LIFT = 350;

type FocusedField = "email" | "password" | "handle";

function capSheetLift(lift: number, keyboardHeight: number): number {
  if (lift <= 0) return 0;
  return Math.min(lift + EXTRA_SHEET_LIFT, MAX_SHEET_LIFT, keyboardHeight * 0.95);
}

type AuthMode = "signIn" | "signUp";

export interface AuthSheetProps {
  visible: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
  /** Which tab to open on. Defaults to creating an account. */
  initialMode?: AuthMode;
}

export function AuthSheet({
  visible,
  onClose,
  onAuthenticated,
  initialMode = "signUp",
}: AuthSheetProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerH = Math.min(
    Math.round(screenH * 0.72),
    screenH - insets.top - spacing.md,
  );

  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const beginGuestUpgrade = useMutation(api.account.beginGuestUpgrade);
  const completeGuestUpgrade = useMutation(api.account.completeGuestUpgrade);
  const setHandleMut = useMutation(api.profiles.setHandle);
  const setOnboarded = useGameStore((s) => s.setOnboarded);
  const convex = useConvex();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [accessoryId, setAccessoryId] = useState(AUTH_ACCESSORY_ID);
  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const handleRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const submitRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const focusedFieldRef = useRef<FocusedField | null>(null);
  const keyboardHeightRef = useRef(0);
  const keyboardAdjustedRef = useRef(false);
  const adjustTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sheet animation (matches the app's drawer chrome) ──────────────────────

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(false);

  const ty        = useSharedValue(drawerH);
  const keyboardLift = useSharedValue(0);
  const backdropO = useSharedValue(0);
  const drawerHSV = useSharedValue(drawerH);
  useEffect(() => { drawerHSV.value = drawerH; }, [drawerH, drawerHSV]);

  // ── Keyboard lift logic (matches OnlineJoinDrawer approach) ──────────────

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
    setKeyboardHeight(0);
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
        const target = submitRef.current;
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
      setKeyboardHeight(height);
      if (
        keyboardAdjustedRef.current &&
        Math.abs(height - prevHeight) < 8
      ) {
        return;
      }
      if (Math.abs(height - prevHeight) >= 8) {
        keyboardAdjustedRef.current = false;
      }
      const dur = "duration" in e && e.duration ? e.duration : 250;
      applyKeyboardAdjustment(height, dur);
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      focusedFieldRef.current = null;
      clearAdjustTimeouts();
      const dur = "duration" in e && e.duration ? e.duration : 250;
      keyboardLift.value =
        Platform.OS === "ios"
          ? withTiming(0, { duration: dur })
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

  const handleFieldFocus = useCallback((field: FocusedField) => {
    focusedFieldRef.current = field;
    keyboardAdjustedRef.current = false;
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
        focusedFieldRef.current === field &&
        !keyboardAdjustedRef.current
      ) {
        applyKeyboardAdjustment(height, 250);
      }
    }, Platform.OS === "ios" ? 320 : 120);
  }, [applyKeyboardAdjustment, clearAdjustTimeouts]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      keyboardLift.value = 0;
      ty.value        = withSpring(drawerH, SPRING_OUT, () => runOnJS(onDone)());
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
      // Fresh open: reset to a clean slate (never keep a typed password around).
      setMode(initialMode);
      setPassword("");
      setHandle("");
      setShowPassword(false);
      setError(null);
      setAccessoryId(`${AUTH_ACCESSORY_ID}-${Date.now()}`);
      ty.value = drawerH; keyboardLift.value = 0; backdropO.value = 0;
      keyboardAdjustedRef.current = false;
      scrollYRef.current = 0;
      setModalVisible(true);
    }
    if (!visible && prevVisible.current && modalVisible) {
      Keyboard.dismiss();
      resetKeyboardLift();
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, drawerH, modalVisible, ty, backdropO, keyboardLift, animateOut, resetKeyboardLift, initialMode]);

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
        runOnJS(dismissKeyboard)();
        runOnJS(resetKeyboardLift)();
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

  // ── Auth logic (guest upgrade preserved) ───────────────────────────────────

  // Mint a migration token while still signed in as the guest (if anonymous).
  const captureGuestToken = async (): Promise<string | null> => {
    if (!isAuthenticated) return null;
    try {
      const { token } = await beginGuestUpgrade({});
      return token;
    } catch {
      return null;
    }
  };

  const finishAuth = async (guestToken: string | null) => {
    if (mode === "signUp" && handle) {
      const trimmedHandle = handle.trim();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await setHandleMut({
            handle: trimmedHandle,
            displayName: trimmedHandle,
          });
          useGameStore.getState().adoptHandleDisplayName(res.handle);
          break;
        } catch {
          /* transient token issues, wait and retry */
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }

    if (guestToken) {
      // Retry briefly: right after sign-in the new auth token may not have
      // propagated yet, in which case the server leaves the token for a retry.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await completeGuestUpgrade({ token: guestToken });
          if (res.migrated) break;
        } catch {
          /* non-fatal: account still works, guest data just not merged */
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    setOnboarded(true);
    trigger("confirm");
    onAuthenticated?.();
    handleClose();
  };

  const validate = (): string | null => {
    if (mode === "signUp") {
      const trimmedHandle = handle.trim();
      if (!trimmedHandle) return "Choose a handle.";
      if (trimmedHandle.length < 3) return "Handle must be at least 3 characters.";
      if (trimmedHandle.length > 20) return "Handle must be at most 20 characters.";
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return "Enter your email address.";
    if (!EMAIL_RE.test(trimmedEmail)) return "That doesn't look like a valid email.";
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return null;
  };

  const handleEmailAuth = async () => {
    if (busy) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      trigger("error");
      return;
    }
    setBusy(true);
    setError(null);

    if (mode === "signUp") {
      try {
        const checkRes = await convex.query(api.profiles.checkHandle, { handle: handle.trim() });
        if (!checkRes.ok) {
          setError(checkRes.error ?? "Invalid handle.");
          trigger("error");
          setBusy(false);
          return;
        }
        if (!checkRes.available) {
          setError("That handle is already taken.");
          trigger("error");
          setBusy(false);
          return;
        }
      } catch (err) {
        setError("Could not verify handle availability.");
        trigger("error");
        setBusy(false);
        return;
      }
    }

    const guestToken = await captureGuestToken();
    try {
      await signIn("password", {
        email: email.trim(),
        password,
        flow: mode,
      });
      await finishAuth(guestToken);
    } catch {
      setError(
        mode === "signUp"
          ? "Could not create the account. That email may already be in use — try signing in instead."
          : "Could not sign in. Check your email and password.",
      );
      trigger("error");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    trigger("selection");
    setMode(next);
    setError(null);
  };

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet    = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value + keyboardLift.value }],
  }));

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (mode !== "signUp" || handle.trim().length >= 3) &&
    !busy;

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
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          />
          <View style={[styles.topAccent, { backgroundColor: ui.panelBorder }]} />

          <GestureDetector gesture={swipeDown}>
            <View>

              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: ui.accentMuted }]} />
              </View>
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: ui.accent }]}>
                  {mode === "signUp" ? "CREATE ACCOUNT" : "WELCOME BACK"}
                </Text>
                <Text style={[styles.headerSub, { color: ui.textPrimary }]}>
                  {mode === "signUp"
                    ? "Keep your progress, gold and friends across devices"
                    : "Sign in to pick up where you left off"}
                </Text>
              </View>
            </View>
          </GestureDetector>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.body,
              keyboardHeight > 0 && { paddingBottom: keyboardHeight + spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => {
              scrollYRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
                {/* Mode toggle — mirrors the Friends drawer tab pills */}
                <View style={styles.modeTabs}>
                  {(
                    [
                      { key: "signUp" as const, label: "CREATE ACCOUNT" },
                      { key: "signIn" as const, label: "SIGN IN" },
                    ]
                  ).map((t) => {
                    const active = mode === t.key;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => switchMode(t.key)}
                        style={[
                          styles.modeTab,
                          { borderColor: active ? ui.accent : ui.panelBorderSoft },
                          active && { backgroundColor: ui.panelBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modeTabText,
                            { color: active ? ui.accent : ui.textMuted },
                          ]}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {mode === "signUp" && (
                  <View
                    style={[
                      styles.inputRow,
                      { backgroundColor: ui.panelBg, borderColor: ui.panelBorder },
                    ]}
                  >
                    <Text style={[styles.inputIcon, { color: ui.accent }]}>@</Text>
                    <TextInput
                      ref={handleRef}
                      style={[styles.input, { color: ui.textPrimary }]}
                      value={handle}
                      onChangeText={(t) => {
                        const clean = t.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
                        setHandle(clean);
                        if (error) setError(null);
                      }}
                      placeholder="Handle (letters, numbers, _)"
                      placeholderTextColor={ui.textFaint}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      editable={!busy}
                      inputAccessoryViewID={
                        Platform.OS === "ios" ? accessoryId : undefined
                      }
                      onFocus={() => handleFieldFocus("handle")}
                    />
                  </View>
                )}

                <View
                  style={[
                    styles.inputRow,
                    { backgroundColor: ui.panelBg, borderColor: ui.panelBorder },
                  ]}
                >
                  <Text style={[styles.inputIcon, { color: ui.accent }]}>✉</Text>
                  <TextInput
                    ref={emailRef}
                    style={[styles.input, { color: ui.textPrimary }]}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (error) setError(null);
                    }}
                    placeholder="Email"
                    placeholderTextColor={ui.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    editable={!busy}
                    inputAccessoryViewID={
                      Platform.OS === "ios" ? accessoryId : undefined
                    }
                    onFocus={() => handleFieldFocus("email")}
                  />
                </View>

                <View
                  style={[
                    styles.inputRow,
                    { backgroundColor: ui.panelBg, borderColor: ui.panelBorder },
                  ]}
                >
                  <Text style={[styles.inputIcon, { color: ui.accent }]}>♦</Text>
                  <TextInput
                    ref={passwordRef}
                    style={[styles.input, { color: ui.textPrimary }]}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (error) setError(null);
                    }}
                    placeholder={
                      mode === "signUp"
                        ? `Password (min ${MIN_PASSWORD_LENGTH} characters)`
                        : "Password"
                    }
                    placeholderTextColor={ui.textFaint}
                    secureTextEntry={!showPassword}
                    textContentType={mode === "signUp" ? "newPassword" : "password"}
                    autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                    returnKeyType="go"
                    onSubmitEditing={() => void handleEmailAuth()}
                    editable={!busy}
                    inputAccessoryViewID={
                      Platform.OS === "ios" ? accessoryId : undefined
                    }
                    onFocus={() => handleFieldFocus("password")}
                  />
                  {password.length > 0 ? (
                    <Pressable
                      onPress={() => setShowPassword((s) => !s)}
                      hitSlop={10}
                    >
                      <Text style={[styles.showToggle, { color: ui.textMuted }]}>
                        {showPassword ? "HIDE" : "SHOW"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {error ? (
                  <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
                ) : null}

                <View ref={submitRef} collapsable={false} style={styles.submitWrap}>
                  <MenuButton
                    label={
                      busy
                        ? "PLEASE WAIT…"
                        : mode === "signUp"
                          ? "CREATE ACCOUNT"
                          : "SIGN IN"
                    }
                    variant="primary"
                    icon={busy ? undefined : "➤"}
                    onPress={() => void handleEmailAuth()}
                    disabled={!canSubmit}
                  />
                  {busy ? (
                    <ActivityIndicator color={ui.accent} style={styles.busySpinner} />
                  ) : null}
                </View>

                {mode === "signUp" ? (
                  <Text style={[styles.hint, { color: ui.textFaint }]}>
                    Your guest progress — gold, credits and friends — moves to
                    the new account automatically.
                  </Text>
                ) : null}
          </ScrollView>
        </Animated.View>

        {Platform.OS === "ios" && (
          <InputAccessoryView nativeID={accessoryId}>
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
  handleWrap: { alignItems: "center", paddingTop: 14, paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.title, letterSpacing: 2.5 },
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
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  modeTabs: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  modeTabText: { ...typography.caption, fontWeight: "800", letterSpacing: 0.5 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  inputIcon: { fontSize: 15 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  showToggle: { ...typography.caption, fontWeight: "800", letterSpacing: 0.5 },
  error: { ...typography.caption, textAlign: "center", lineHeight: 18 },
  submitWrap: { marginTop: spacing.xs },
  busySpinner: { position: "absolute", right: spacing.lg, top: 16 },
  hint: {
    ...typography.caption,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: spacing.md,
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
