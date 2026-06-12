import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";

import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Background } from "../components/Background";
import { CardFan } from "../components/CardFan";
import { GlowTitle, HeroPanel, StaticTitle } from "../components/HomeHero";
import { MenuButton } from "../components/MenuButton";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameLayout } from "../theme/useGameLayout";
import { useAppActive } from "../hooks/useAppActive";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { usePreferencesStore } from "../game/preferencesStore";
import { useGameStore } from "../game/store";
import { type HealthStatus, useHealthCheck } from "../hooks/useHealthCheck";
import { convexEnabled } from "../game/convexClient";
import { trigger } from "../feedback/haptics";
import { colors, spacing, typography } from "../theme";

// ── Step definitions ─────────────────────────────────────────────────────────

type StepStatus = "waiting" | "active" | "done" | "failed";

interface BootStep {
  key: string;
  label: string;
  failLabel?: string;
}

const STEPS: BootStep[] = [
  { key: "prefs", label: "Loading preferences" },
  {
    key: "server",
    label: "Connecting to server",
    failLabel: "Connection failed",
  },
  { key: "auth", label: "Signing in" },
  { key: "data", label: "Syncing data" },
];

// Without Convex, we skip server/auth/data steps.
const OFFLINE_STEPS: BootStep[] = [
  { key: "prefs", label: "Loading preferences" },
];

// ── Store links for retry / update ───────────────────────────────────────────

const APP_STORE_URL = Platform.select({
  ios: "https://apps.apple.com/app/id6745174792",
  android:
    "https://play.google.com/store/apps/details?id=com.kedrov.durakgame",
  default: "",
});

// ── Component ────────────────────────────────────────────────────────────────

export interface BootScreenProps {
  /** Called when all health checks pass and the app can transition in. */
  onReady: () => void;
}

export function BootScreen({ onReady }: BootScreenProps) {
  const ui = useUiTheme();
  const lay = useGameLayout();
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const animate = !reduceMotion && appActive;


  // ── Readiness signals ────────────────────────────────────────────────────
  const appearanceLoaded = usePreferencesStore((s) => s.appearanceLoaded);
  const onboardedHydrated = useGameStore((s) => s.onboardedHydrated);
  const { status: healthStatus, retry: retryHealth } = useHealthCheck();

  const steps = convexEnabled ? STEPS : OFFLINE_STEPS;

  // ── Compute step statuses ────────────────────────────────────────────────
  const stepStatuses = computeStepStatuses(
    steps,
    appearanceLoaded,
    healthStatus,
    onboardedHydrated,
  );

  const allDone = stepStatuses.every((s) => s === "done");
  const hasFailed = stepStatuses.some((s) => s === "failed");

  // ── Splash screen hide ──────────────────────────────────────────────────
  const splashHiddenRef = useRef(false);
  const onReadyFiredRef = useRef(false);

  useEffect(() => {
    if (!splashHiddenRef.current) {
      splashHiddenRef.current = true;
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  // ── Fire onReady after a brief hold ──────────────────────────────────────
  useEffect(() => {
    if (!allDone || onReadyFiredRef.current) return;
    const timer = setTimeout(() => {
      if (onReadyFiredRef.current) return;
      onReadyFiredRef.current = true;
      trigger("confirm");
      onReady();
    }, 600);
    return () => clearTimeout(timer);
  }, [allDone, onReady]);

  // ── Animated progress bar ───────────────────────────────────────────────
  const doneCount = stepStatuses.filter((s) => s === "done").length;
  const progressTarget = allDone ? 1 : doneCount / steps.length;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(progressTarget, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [progressTarget, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.value * 100)}%` as `${number}%`,
  }));

  // ── Pulsing dot animation for active step ───────────────────────────────
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const isOutdated = healthStatus === "outdated";

  const handleUpdate = useCallback(() => {
    if (APP_STORE_URL) {
      void Linking.openURL(APP_STORE_URL);
    }
  }, []);

  const handleRetry = useCallback(() => {
    trigger("uiTap");
    retryHealth();
  }, [retryHealth]);

  return (
    <Background variant="home">
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.content, { paddingHorizontal: lay.hPad }]}>
          {/* ── Hero area ─────────────────────────────────────── */}
          <Animated.View
            entering={
              animate
                ? FadeIn.duration(400).easing(Easing.out(Easing.cubic))
                : undefined
            }
            style={styles.heroArea}
          >
            <HeroPanel maxWidth={lay.maxContent}>
              <View
                style={[
                  styles.fanWrap,
                  { height: lay.s(150), marginBottom: lay.s(spacing.sm) },
                ]}
              >
                <CardFan animate={animate} />
              </View>
              {animate ? <GlowTitle /> : <StaticTitle />}
            </HeroPanel>
          </Animated.View>

          {/* ── Check steps area ──────────────────────────────── */}
          <Animated.View
            entering={
              animate
                ? FadeInDown.delay(200)
                    .duration(400)
                    .easing(Easing.out(Easing.cubic))
                : undefined
            }
            style={[styles.stepsArea, { maxWidth: lay.maxContent }]}
          >
            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: ui.panelBorderSoft }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: allDone ? colors.success : ui.accent },
                  progressStyle,
                ]}
              />
            </View>

            {/* Step list */}
            <View style={styles.stepList}>
              {steps.map((step, i) => (
                <StepRow
                  key={step.key}
                  step={step}
                  status={stepStatuses[i]!}
                  index={i}
                  pulse={pulse}
                  animate={animate}
                  ui={ui}
                />
              ))}
            </View>

            {/* ── Error / outdated state ──────────────────────── */}
            {hasFailed && !isOutdated && (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={styles.errorArea}
              >
                <Text style={[styles.errorIcon]}>⚠</Text>
                <Text style={[styles.errorTitle, { color: colors.danger }]}>
                  Could not connect to server
                </Text>
                <Text style={[styles.errorBody, { color: ui.textMuted }]}>
                  Please check your internet connection and try again.
                  {"\n"}If this persists, the game may need an update.
                </Text>
                <View style={styles.errorButtons}>
                  <MenuButton
                    label="RETRY"
                    variant="primary"
                    icon="↻"
                    onPress={handleRetry}
                  />
                  {APP_STORE_URL ? (
                    <MenuButton
                      label="UPDATE GAME"
                      variant="secondary"
                      icon="⬆"
                      onPress={handleUpdate}
                    />
                  ) : null}
                </View>
              </Animated.View>
            )}

            {isOutdated && (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={styles.errorArea}
              >
                <Text style={[styles.errorIcon]}>🔄</Text>
                <Text style={[styles.errorTitle, { color: ui.accent }]}>
                  Update Required
                </Text>
                <Text style={[styles.errorBody, { color: ui.textMuted }]}>
                  A new version of Durak is available. Please update to
                  continue playing.
                </Text>
                <View style={styles.errorButtons}>
                  <MenuButton
                    label="UPDATE GAME"
                    variant="primary"
                    icon="⬆"
                    onPress={handleUpdate}
                  />
                  <MenuButton
                    label="RETRY"
                    variant="secondary"
                    icon="↻"
                    onPress={handleRetry}
                  />
                </View>
              </Animated.View>
            )}

            {/* All done message */}
            {allDone && (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={styles.readyWrap}
              >
                <Text style={[styles.readyText, { color: colors.success }]}>
                  ✓ Ready
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>
    </Background>
  );
}

// ── Step row component ─────────────────────────────────────────────────────

function StepRow({
  step,
  status,
  index,
  pulse,
  animate,
  ui,
}: {
  step: BootStep;
  status: StepStatus;
  index: number;
  pulse: SharedValue<number>;
  animate: boolean;
  ui: ReturnType<typeof useUiTheme>;
}) {
  const dotStyle = useAnimatedStyle(() => {
    if (status !== "active") return {};
    return {
      opacity: interpolate(pulse.value, [0, 1], [0.4, 1]),
      transform: [{ scale: interpolate(pulse.value, [0, 1], [0.8, 1.2]) }],
    };
  });

  const icon =
    status === "done"
      ? "✓"
      : status === "failed"
        ? "✗"
        : status === "active"
          ? "●"
          : "○";

  const iconColor =
    status === "done"
      ? colors.success
      : status === "failed"
        ? colors.danger
        : status === "active"
          ? ui.accent
          : ui.textFaint;

  const labelColor =
    status === "done"
      ? ui.textMuted
      : status === "failed"
        ? colors.danger
        : status === "active"
          ? ui.textPrimary
          : ui.textFaint;

  const label =
    status === "failed" && step.failLabel ? step.failLabel : step.label;

  return (
    <Animated.View
      entering={
        animate
          ? FadeInDown.delay(300 + index * 120)
              .duration(300)
              .easing(Easing.out(Easing.cubic))
          : undefined
      }
      style={styles.stepRow}
    >
      <Animated.Text style={[styles.stepIcon, { color: iconColor }, dotStyle]}>
        {icon}
      </Animated.Text>
      <Text style={[styles.stepLabel, { color: labelColor }]}>{label}</Text>
      {status === "active" && (
        <ActivityIndicator
          size="small"
          color={ui.accent}
          style={styles.stepSpinner}
        />
      )}
    </Animated.View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function computeStepStatuses(
  steps: BootStep[],
  appearanceLoaded: boolean,
  healthStatus: HealthStatus,
  onboardedHydrated: boolean,
): StepStatus[] {
  return steps.map((step) => {
    switch (step.key) {
      case "prefs":
        return appearanceLoaded ? "done" : "active";

      case "server":
        if (!appearanceLoaded) return "waiting";
        if (healthStatus === "checking") return "active";
        if (healthStatus === "ok") return "done";
        return "failed"; // "failed" or "outdated"

      case "auth":
        if (!appearanceLoaded || healthStatus !== "ok") return "waiting";
        // Auth is managed by ConvexAuthProvider — we consider it done once
        // the health check passes because the auth bootstrap runs in parallel.
        // If auth truly failed, the user would see it on any online action.
        return "done";

      case "data":
        if (!appearanceLoaded || healthStatus !== "ok") return "waiting";
        return onboardedHydrated ? "done" : "active";

      default:
        return "waiting";
    }
  });
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  heroArea: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fanWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  stepsArea: {
    width: "100%",
    alignSelf: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
  },

  // ── Progress bar ──────────────────────────────────────────────
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },

  // ── Step rows ─────────────────────────────────────────────────
  stepList: {
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    gap: spacing.sm,
  },
  stepIcon: {
    fontSize: 14,
    width: 20,
    textAlign: "center",
    fontWeight: "800",
  },
  stepLabel: {
    ...typography.body,
    letterSpacing: 0.3,
    flex: 1,
  },
  stepSpinner: {
    marginLeft: "auto",
  },

  // ── Error state ───────────────────────────────────────────────
  errorArea: {
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  errorIcon: {
    fontSize: 36,
  },
  errorTitle: {
    ...typography.heading,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  errorBody: {
    ...typography.body,
    textAlign: "center",
    lineHeight: 20,
  },
  errorButtons: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  // ── Ready state ───────────────────────────────────────────────
  readyWrap: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  readyText: {
    ...typography.heading,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
