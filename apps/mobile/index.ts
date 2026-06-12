// Gesture Handler must be imported at the very top of the entry file.
import "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";

import App from "./App";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash API unavailable — App will hide when ready or fall through.
});

registerRootComponent(App);
