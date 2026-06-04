import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { loadPreferences } from "./src/game/preferencesStore";
import { loadGameConfig, useGameStore } from "./src/game/store";
import { useOnlineGame } from "./src/game/useOnlineGame";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LobbyScreen } from "./src/screens/LobbyScreen";
import { GameScreen } from "./src/screens/GameScreen";
import { ResultScreen } from "./src/screens/ResultScreen";
import { SettingsModal } from "./src/components/SettingsModal";
import { RulesModal } from "./src/components/RulesModal";
import { CardThemeProvider } from "./src/theme/CardThemeContext";
import { TableThemeProvider } from "./src/theme/TableThemeContext";
import { UiThemeProvider } from "./src/theme/UiThemeContext";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = convexUrl
  ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
  : null;

function OnlineGameSync() {
  useOnlineGame();
  return null;
}

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);

  useEffect(() => {
    void Promise.all([loadPreferences(), loadGameConfig()]);
  }, []);

  const content = (
    <>
      <OnlineGameSync />
      <StatusBar style="light" />
      {screen === "home" && (
        <HomeScreen
          onOpenSettings={() => setSettingsVisible(true)}
          onOpenRules={() => setRulesVisible(true)}
        />
      )}
      {screen === "lobby" && <LobbyScreen />}
      {screen === "game" && (
        <GameScreen onOpenSettings={() => setSettingsVisible(true)} />
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
              {convex ? (
                <ConvexProvider client={convex}>{content}</ConvexProvider>
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
