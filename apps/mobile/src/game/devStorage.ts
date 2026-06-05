import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadGameConfig, loadGold, loadPlayerName, useGameStore } from "./store";
import { loadPreferences } from "./preferencesStore";
import { resetPlayerNameStorageCache } from "./playerNameStorage";
import { resetGoldStorageCache } from "./goldStorage";
import { clearRoomSession } from "./onlineSessionStorage";

const DURAK_PREFIX = "@durak/";

/** Dev/testing: wipe persisted app data and reload in-memory defaults. */
export async function clearAllAppStorage(): Promise<void> {
  resetPlayerNameStorageCache();
  resetGoldStorageCache();

  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith(DURAK_PREFIX) || k === "durak:onlineSession",
      );
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    }
  } else {
    await AsyncStorage.clear();
  }

  await clearRoomSession();

  useGameStore.getState().goHome();

  await Promise.all([loadPlayerName(), loadGameConfig(), loadGold(), loadPreferences()]);
}
