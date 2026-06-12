import { Platform } from "react-native";
import { getNativeStorage } from "./nativeAsyncStorage";

const STORAGE_KEY = "@durak/hapticsEnabled";

/** In-memory fallback when native AsyncStorage is unavailable. */
let memoryValue: string | null = null;

function webGet(): string | null {
  if (typeof localStorage === "undefined") {
    return memoryValue;
  }
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryValue;
  }
}

function webSet(value: string): void {
  memoryValue = value;
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore quota / privacy errors
  }
}

export async function getStoredHapticsEnabled(): Promise<boolean | null> {
  if (Platform.OS === "web") {
    const value = webGet();
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }

  const storage = await getNativeStorage();
  if (!storage) {
    if (memoryValue === "true") return true;
    if (memoryValue === "false") return false;
    return null;
  }

  try {
    const value = await storage.getItem(STORAGE_KEY);
    memoryValue = value;
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  } catch {
    if (memoryValue === "true") return true;
    if (memoryValue === "false") return false;
    return null;
  }
}

export async function setStoredHapticsEnabled(enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";
  memoryValue = value;

  if (Platform.OS === "web") {
    webSet(value);
    return;
  }

  const storage = await getNativeStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.setItem(STORAGE_KEY, value);
  } catch {
    // Native module missing or write failed — memory fallback already set
  }
}
