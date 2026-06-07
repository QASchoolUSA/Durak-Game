// Gesture Handler must be imported at the very top of the entry file.
import "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";

import App from "./App";
import { loadPreferences } from "./src/game/preferencesStore";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash API unavailable — App will hide when ready or fall through.
});

// Start loading saved theme before first paint; must not block registration (Expo Go).
void loadPreferences();

registerRootComponent(App);
