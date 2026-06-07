import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadGameConfig, loadGold, loadPlayerName, useGameStore } from "./store";
import { loadPreferences } from "./preferencesStore";
import { resetPlayerNameStorageCache } from "./playerNameStorage";
import { resetCreditStorageCache } from "./creditStorage";
import { resetGoldStorageCache } from "./goldStorage";
import { clearRoomSession } from "./onlineSessionStorage";

const DURAK_PREFIX = "@durak/";

function isDurakStorageKey(key: string): boolean {
  return key.startsWith(DURAK_PREFIX) || key === "durak:onlineSession";
}

/** Dev/testing: wipe persisted app data and reload in-memory defaults. */
export async function clearAllAppStorage(): Promise<void> {
  resetPlayerNameStorageCache();
  resetGoldStorageCache();
  resetCreditStorageCache();

  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      const keys = Object.keys(localStorage).filter(isDurakStorageKey);
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    }
  } else {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(isDurakStorageKey);
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  }

  await clearRoomSession();

  useGameStore.getState().goHome();

  await Promise.all([loadPlayerName(), loadGameConfig(), loadGold(), loadPreferences()]);
}
