import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BootSpinner } from "../components/BootSpinner";
import { MenuButton } from "../components/MenuButton";
import { useBootReadiness } from "../hooks/useBootReadiness";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { trigger } from "../feedback/haptics";
import { colors, radius, spacing } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";

const APP_STORE_URL = Platform.select({
  ios: "https://apps.apple.com/app/id6745174792",
  android: "https://play.google.com/store/apps/details?id=com.kedrov.durakgame",
  default: "",
});

export interface BootScreenProps {
  onReady: () => void;
}

export function BootScreen({ onReady }: BootScreenProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const lay = useGameLayout();
  const { ready, loading, failed, outdated, retryHealth } = useBootReadiness();

  const splashHiddenRef = useRef(false);
  const onReadyFiredRef = useRef(false);

  const backdropColors = useMemo((): [string, string, ...string[]] => {
    const grad = tableTheme.backgroundGradient ?? [
      tableTheme.backgroundColor,
      tableTheme.backgroundColor,
    ];
    return grad.length >= 2
      ? (grad as [string, string, ...string[]])
      : [grad[0]!, grad[0]!];
  }, [tableTheme.backgroundColor, tableTheme.backgroundGradient]);

  const hideSplash = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hide();
  }, []);

  useEffect(() => {
    if (!ready || onReadyFiredRef.current) return;
    const timer = setTimeout(() => {
      if (onReadyFiredRef.current) return;
      onReadyFiredRef.current = true;
      trigger("confirm");
      onReady();
    }, 180);
    return () => clearTimeout(timer);
  }, [ready, onReady]);

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
    <LinearGradient
      colors={backdropColors}
      style={styles.fill}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      onLayout={hideSplash}
    >
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View
          style={[styles.content, { paddingHorizontal: lay.s(spacing.lg), maxWidth: lay.maxContent }]}
          pointerEvents="box-none"
        >
          {loading && (
            <Animated.View entering={FadeIn.duration(220)} style={styles.center}>
              <BootSpinner />
            </Animated.View>
          )}

          {failed && (
            <Animated.View
              entering={FadeInDown.duration(280)}
              style={[
                styles.card,
                {
                  backgroundColor: ui.panelBg,
                  borderColor: ui.panelBorderSoft,
                  maxWidth: lay.s(320),
                  paddingHorizontal: lay.s(spacing.lg),
                  paddingVertical: lay.s(spacing.lg),
                  gap: lay.s(spacing.sm),
                },
              ]}
            >
              <Text style={[styles.errorIcon, { fontSize: lay.s(32), marginBottom: lay.s(spacing.xs) }]}>
                ⚠
              </Text>
              <Text style={[styles.errorTitle, { color: colors.danger, ...lay.typography.heading }]}>
                Could not connect
              </Text>
              <Text style={[styles.errorBody, { color: ui.textMuted, ...lay.typography.body, lineHeight: lay.s(20), marginBottom: lay.s(spacing.sm) }]}>
                Check your connection and try again.
              </Text>
              <View style={[styles.actions, { gap: lay.s(spacing.sm) }]}>
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

          {outdated && (
            <Animated.View
              entering={FadeInDown.duration(280)}
              style={[
                styles.card,
                {
                  backgroundColor: ui.panelBg,
                  borderColor: ui.panelBorderSoft,
                  maxWidth: lay.s(320),
                  paddingHorizontal: lay.s(spacing.lg),
                  paddingVertical: lay.s(spacing.lg),
                  gap: lay.s(spacing.sm),
                },
              ]}
            >
              <Text style={[styles.errorIcon, { fontSize: lay.s(32), marginBottom: lay.s(spacing.xs) }]}>
                🔄
              </Text>
              <Text style={[styles.errorTitle, { color: ui.accent, ...lay.typography.heading }]}>
                Update required
              </Text>
              <Text style={[styles.errorBody, { color: ui.textMuted, ...lay.typography.body, lineHeight: lay.s(20), marginBottom: lay.s(spacing.sm) }]}>
                A new version of Durak is available.
              </Text>
              <View style={[styles.actions, { gap: lay.s(spacing.sm) }]}>
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
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: "transparent" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    width: "100%",
    backgroundColor: "transparent",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    alignItems: "center",
    borderRadius: radius.panel,
    borderWidth: 1,
  },
  errorIcon: {},
  errorTitle: {
    fontWeight: "800",
    textAlign: "center",
  },
  errorBody: {
    textAlign: "center",
  },
  actions: {
    width: "100%",
  },
});
