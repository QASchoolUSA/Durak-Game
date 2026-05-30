import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useGameStore } from "./src/game/store";
import { HomeScreen } from "./src/screens/HomeScreen";
import { GameScreen } from "./src/screens/GameScreen";
import { ResultScreen } from "./src/screens/ResultScreen";

export default function App() {
  const screen = useGameStore((s) => s.screen);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {screen === "home" && <HomeScreen />}
        {screen === "game" && <GameScreen />}
        {screen === "result" && <ResultScreen />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
