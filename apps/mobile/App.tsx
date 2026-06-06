import React, { Component, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { loadPreferences } from "./src/game/preferencesStore";
import {
  loadCredits,
  loadGameConfig,
  loadGold,
  loadPlayerName,
  useGameStore,
} from "./src/game/store";
import { convex, convexEnabled } from "./src/game/convexClient";
import { convexTokenStorage } from "./src/game/convexTokenStorage";
import { AuthBootstrap } from "./src/game/useAuthBootstrap";
import { useGoldWallet } from "./src/game/useGoldWallet";
import { useOnlineGame } from "./src/game/useOnlineGame";
import { usePlaySessionIdle } from "./src/game/usePlaySessionIdle";
import { OnlineStatusBanner } from "./src/components/OnlineStatusBanner";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LobbyScreen } from "./src/screens/LobbyScreen";
import { GameScreen } from "./src/screens/GameScreen";
import { ResultScreen } from "./src/screens/ResultScreen";
import { SettingsModal } from "./src/components/SettingsModal";
import { RulesModal } from "./src/components/RulesModal";
import { CardThemeProvider } from "./src/theme/CardThemeContext";
import { TableThemeProvider } from "./src/theme/TableThemeContext";
import { UiThemeProvider } from "./src/theme/UiThemeContext";
import { PerfOverlay } from "./src/dev/PerfOverlay";
import { colors } from "./src/theme";

type ScreenErrorBoundaryProps = {
  children: React.ReactNode;
  screenName: string;
};

type ScreenErrorBoundaryState = {
  error: Error | null;
};

class ScreenErrorBoundary extends Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
  state: ScreenErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ScreenErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error(`[${this.props.screenName}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorBody}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function OnlineGameSync() {
  usePlaySessionIdle();
  useOnlineGame();
  return null;
}

function PlaySessionIdleSync() {
  usePlaySessionIdle();
  return null;
}

function GoldWalletSync() {
  useGoldWallet();
  return null;
}

function ConvexOnlineLayer({ children }: { children: React.ReactNode }) {
  if (!convex) {
    return (
      <>
        <PlaySessionIdleSync />
        {children}
      </>
    );
  }
  return (
    <ConvexAuthProvider client={convex} storage={convexTokenStorage}>
      <AuthBootstrap />
      <OnlineGameSync />
      <GoldWalletSync />
      {children}
    </ConvexAuthProvider>
  );
}

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);

  useEffect(() => {
    void Promise.all([
      loadPreferences(),
      loadGameConfig(),
      loadPlayerName(),
      loadGold(),
      loadCredits(),
    ]);
  }, []);

  const content = (
    <>
      <OnlineStatusBanner />
      <PerfOverlay />
      <StatusBar style="light" />
      {screen === "home" && (
        <HomeScreen
          onOpenSettings={() => setSettingsVisible(true)}
          onOpenRules={() => setRulesVisible(true)}
        />
      )}
      {screen === "lobby" && <LobbyScreen />}
      {screen === "game" && (
        <ScreenErrorBoundary screenName="GameScreen">
          <GameScreen onOpenSettings={() => setSettingsVisible(true)} />
        </ScreenErrorBoundary>
      )}
      {screen === "result" && <ResultScreen />}

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
              <ConvexOnlineLayer>{content}</ConvexOnlineLayer>
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
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    color: "#F5F3EC",
    fontSize: 14,
    textAlign: "center",
  },
});
