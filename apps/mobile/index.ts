// Gesture Handler must be imported at the very top of the entry file.
import "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";

import App from "./App";

SplashScreen.setOptions({
  fade: false,
  duration: 0,
});

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash API unavailable — BootScreen hides when its first frame is ready.
});

registerRootComponent(App);
