import React, { Suspense, lazy, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { loadPreferences } from "./src/game/preferencesStore";
import { loadGameConfig, loadGold, loadPlayerName, useGameStore } from "./src/game/store";
import { convexTokenStorage } from "./src/game/convexTokenStorage";
import { AuthBootstrap } from "./src/game/useAuthBootstrap";
import { useGoldWallet } from "./src/game/useGoldWallet";
import { useOnlineGame } from "./src/game/useOnlineGame";
import { OnlineStatusBanner } from "./src/components/OnlineStatusBanner";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SettingsModal } from "./src/components/SettingsModal";
import { RulesModal } from "./src/components/RulesModal";
import { CardThemeProvider } from "./src/theme/CardThemeContext";
import { TableThemeProvider } from "./src/theme/TableThemeContext";
import { UiThemeProvider } from "./src/theme/UiThemeContext";
import { PerfOverlay } from "./src/dev/PerfOverlay";
import { colors } from "./src/theme";

const LobbyScreen = lazy(() =>
  import("./src/screens/LobbyScreen").then((m) => ({ default: m.LobbyScreen })),
);
const GameScreen = lazy(() =>
  import("./src/screens/GameScreen").then((m) => ({ default: m.GameScreen })),
);
const ResultScreen = lazy(() =>
  import("./src/screens/ResultScreen").then((m) => ({ default: m.ResultScreen })),
);

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = convexUrl
  ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
  : null;

function ScreenFallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="large" color={colors.gold} />
    </View>
  );
}

function OnlineGameSync() {
  useOnlineGame();
  return null;
}

function GoldWalletSync() {
  useGoldWallet();
  return null;
}

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);

  useEffect(() => {
    void Promise.all([loadPreferences(), loadGameConfig(), loadPlayerName(), loadGold()]);
  }, []);

  const content = (
    <>
      <AuthBootstrap />
      <OnlineGameSync />
      <GoldWalletSync />
      <OnlineStatusBanner />
      <PerfOverlay />
      <StatusBar style="light" />
      {screen === "home" && (
        <HomeScreen
          onOpenSettings={() => setSettingsVisible(true)}
          onOpenRules={() => setRulesVisible(true)}
        />
      )}
      {screen === "lobby" && (
        <Suspense fallback={<ScreenFallback />}>
          <LobbyScreen />
        </Suspense>
      )}
      {screen === "game" && (
        <Suspense fallback={<ScreenFallback />}>
          <GameScreen onOpenSettings={() => setSettingsVisible(true)} />
        </Suspense>
      )}
      {screen === "result" && (
        <Suspense fallback={<ScreenFallback />}>
          <ResultScreen />
        </Suspense>
      )}

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <RulesModal
        visible={rulesVisible}
        onClose={() => setRulesVisible(false)}
      />
    </>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TableThemeProvider>
          <UiThemeProvider>
            <CardThemeProvider>
              {convex ? (
                <ConvexAuthProvider client={convex} storage={convexTokenStorage}>
                  {content}
                </ConvexAuthProvider>
              ) : (
                content
              )}
            </CardThemeProvider>
          </UiThemeProvider>
        </TableThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.feltBottom,
  },
});
