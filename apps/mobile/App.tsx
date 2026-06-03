import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadPreferences } from "./src/game/preferencesStore";
import { useGameStore } from "./src/game/store";
import { HomeScreen } from "./src/screens/HomeScreen";
import { GameScreen } from "./src/screens/GameScreen";
import { ResultScreen } from "./src/screens/ResultScreen";
import { SettingsModal } from "./src/components/SettingsModal";
import { RulesModal } from "./src/components/RulesModal";
import { CardThemeProvider } from "./src/theme/CardThemeContext";
import { TableThemeProvider } from "./src/theme/TableThemeContext";

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);

  useEffect(() => {
    void loadPreferences();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TableThemeProvider>
        <StatusBar style="light" />
        {screen === "home" && (
          <HomeScreen
            onOpenSettings={() => setSettingsVisible(true)}
            onOpenRules={() => setRulesVisible(true)}
          />
        )}
        {screen === "game" && (
          <CardThemeProvider>
            <GameScreen onOpenSettings={() => setSettingsVisible(true)} />
          </CardThemeProvider>
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
        </TableThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
