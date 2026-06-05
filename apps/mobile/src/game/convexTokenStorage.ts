import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TokenStorage } from "@convex-dev/auth/react";

const memory = new Map<string, string>();

function webStorage(): TokenStorage {
  return {
    getItem(key: string) {
      if (typeof localStorage === "undefined") return memory.get(key) ?? null;
      try {
        return localStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(key, value);
      } catch {
        // Ignore quota / privacy errors
      }
    },
    removeItem(key: string) {
      memory.delete(key);
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    },
  };
}

function nativeStorage(): TokenStorage {
  return {
    getItem(key: string) {
      return memory.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
      void AsyncStorage.setItem(key, value).catch(() => {
        // Ignore write failures
      });
    },
    removeItem(key: string) {
      memory.delete(key);
      void AsyncStorage.removeItem(key).catch(() => {
        // Ignore delete failures
      });
    },
  };
}

export const convexTokenStorage: TokenStorage =
  Platform.OS === "ios" || Platform.OS === "android" ? nativeStorage() : webStorage();

void (async () => {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter((k) => k.includes("convex") || k.includes("auth"));
    if (authKeys.length === 0) return;
    const pairs = await AsyncStorage.multiGet(authKeys);
    for (const [key, value] of pairs) {
      if (value != null) memory.set(key, value);
    }
  } catch {
    // Ignore preload failures
  }
})();
