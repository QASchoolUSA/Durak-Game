import React, { Component, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { usePreferencesStore, loadPreferences } from "./src/game/preferencesStore";
import {
  loadCredits,
  loadGameConfig,
  loadGold,
  loadOnboarded,
  loadPlayerName,
  useGameStore,
} from "./src/game/store";
import { convex, convexEnabled } from "./src/game/convexClient";
import { convexTokenStorage } from "./src/game/convexTokenStorage";
import { AuthGateProvider } from "./src/game/useAuthBootstrap";
import { useGoldWallet } from "./src/game/useGoldWallet";
import { useSoloCreditSettlement } from "./src/game/useSoloCreditSettlement";
import { useOnlineGame } from "./src/game/useOnlineGame";
import { usePlaySessionIdle } from "./src/game/usePlaySessionIdle";
import { usePushRegistration } from "./src/game/usePushRegistration";
import { useProfileNameSync } from "./src/game/useProfileNameSync";
import { useDeepLinking } from "./src/hooks/useDeepLinking";
import { OnlineStatusBanner } from "./src/components/OnlineStatusBanner";
import { IncomingInviteBanner } from "./src/components/IncomingInviteBanner";
import { ResumeGameBanner } from "./src/components/ResumeGameBanner";
import { GameResultCrossfade } from "./src/components/GameResultCrossfade";
import { HomeScreen } from "./src/screens/HomeScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { LobbyScreen } from "./src/screens/LobbyScreen";
import { BootScreen } from "./src/screens/BootScreen";
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
  useSoloCreditSettlement();
  return null;
}

function PushSync() {
  usePushRegistration();
  return null;
}

function DeepLinkSync() {
  useDeepLinking();
  return null;
}

function ProfileNameSync() {
  useProfileNameSync();
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
      <AuthGateProvider>
        <OnlineGameSync />
        <GoldWalletSync />
        <PushSync />
        <DeepLinkSync />
        <ProfileNameSync />
        {children}
        <IncomingInviteBanner />
        <ResumeGameBanner />
      </AuthGateProvider>
    </ConvexAuthProvider>
  );
}



export default function App() {
  const screen = useGameStore((s) => s.screen);
  const game = useGameStore((s) => s.game);
  const onboarded = useGameStore((s) => s.onboarded);
  const onboardedHydrated = useGameStore((s) => s.onboardedHydrated);
  const appearanceLoaded = usePreferencesStore((s) => s.appearanceLoaded);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [homeMounted, setHomeMounted] = useState(screen === "home");
  const [bootComplete, setBootComplete] = useState(false);

  useEffect(() => {
    void Promise.all([
      loadPreferences(),
      loadGameConfig(),
      loadPlayerName(),
      loadGold(),
      loadCredits(),
      loadOnboarded(),
    ]);
  }, []);

  useEffect(() => {
    if (screen === "home") {
      setHomeMounted(true);
    }
  }, [screen]);

  const showHome = screen === "home";
  // Show the welcome/auth landing on first run. With no Convex backend the auth
  // hooks can't run, so guests skip straight in.
  const showWelcome = convexEnabled && onboardedHydrated && !onboarded;

  const content = (
    <View style={styles.appShell}>
      <OnlineStatusBanner />
      <PerfOverlay />
      <StatusBar style="light" />
      {homeMounted && (
        <View
          style={showHome ? styles.homeLayerActive : styles.homeLayerHidden}
          pointerEvents={showHome ? "auto" : "none"}
        >
          <HomeScreen
            onOpenSettings={() => setSettingsVisible(true)}
            onOpenRules={() => setRulesVisible(true)}
          />
        </View>
      )}
      {screen === "lobby" && <LobbyScreen />}
      <GameResultCrossfade
        screen={screen}
        game={game}
        onOpenSettings={() => setSettingsVisible(true)}
        errorBoundary={(children) => (
          <ScreenErrorBoundary screenName="GameScreen">{children}</ScreenErrorBoundary>
        )}
        resultErrorBoundary={(children) => (
          <ScreenErrorBoundary screenName="ResultScreen">{children}</ScreenErrorBoundary>
        )}
      />

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <RulesModal
        visible={rulesVisible}
        onClose={() => setRulesVisible(false)}
      />

      {showWelcome && (
        <View style={styles.welcomeLayer}>
          <WelcomeScreen />
        </View>
      )}
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TableThemeProvider>
          <UiThemeProvider>
            <CardThemeProvider>
              <ConvexOnlineLayer>
                {!bootComplete && (
                  <View style={styles.bootLayer}>
                    <BootScreen onReady={() => setBootComplete(true)} />
                  </View>
                )}
                {bootComplete && content}
              </ConvexOnlineLayer>
            </CardThemeProvider>
          </UiThemeProvider>
        </TableThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bootLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  appShell: {
    flex: 1,
  },
  homeLayerActive: {
    flex: 1,
  },
  homeLayerHidden: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
    zIndex: -1,
  },
  welcomeLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
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
