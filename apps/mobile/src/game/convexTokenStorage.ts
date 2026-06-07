import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
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

let migrationPromise: Promise<void> | null = null;

async function migrateFromAsyncStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter((k) => k.includes("convex") || k.includes("auth"));
    if (authKeys.length === 0) return;

    const pairs = await AsyncStorage.multiGet(authKeys);
    for (const [key, value] of pairs) {
      if (value == null) continue;
      const existing = await SecureStore.getItemAsync(key).catch(() => null);
      if (existing == null) {
        await SecureStore.setItemAsync(key, value).catch(() => {
          // Ignore per-key migration failures
        });
      }
      await AsyncStorage.removeItem(key).catch(() => {
        // Ignore cleanup failures
      });
    }
  } catch {
    // Ignore migration failures — fresh sign-in still works
  }
}

function ensureMigration(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateFromAsyncStorage();
  }
  return migrationPromise;
}

function nativeStorage(): TokenStorage {
  return {
    async getItem(key: string) {
      await ensureMigration();
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string) {
      await ensureMigration();
      try {
        await SecureStore.setItemAsync(key, value);
      } catch {
        // Ignore write failures
      }
    },
    async removeItem(key: string) {
      await ensureMigration();
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore delete failures
      }
    },
  };
}

export const convexTokenStorage: TokenStorage =
  Platform.OS === "ios" || Platform.OS === "android" ? nativeStorage() : webStorage();
