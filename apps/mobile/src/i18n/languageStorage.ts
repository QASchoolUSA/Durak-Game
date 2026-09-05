import { Platform } from "react-native";
import { getNativeStorage } from "../game/nativeAsyncStorage";

const STORAGE_KEY = "@durak/languagePreference";

/** `"system"` follows the device locale; otherwise a fixed app language. */
export type LanguagePreference = "system" | "en" | "ru" | "uk";

export type AppLanguage = "en" | "ru" | "uk";

export const LANGUAGE_PREFERENCE_OPTIONS: LanguagePreference[] = [
  "system",
  "en",
  "ru",
  "uk",
];

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

function parsePreference(value: string | null): LanguagePreference | null {
  if (value === "system" || value === "en" || value === "ru" || value === "uk") {
    return value;
  }
  return null;
}

export async function getStoredLanguagePreference(): Promise<LanguagePreference | null> {
  if (Platform.OS === "web") {
    return parsePreference(webGet());
  }

  const storage = await getNativeStorage();
  if (!storage) {
    return parsePreference(memoryValue);
  }

  try {
    const value = await storage.getItem(STORAGE_KEY);
    memoryValue = value;
    return parsePreference(value);
  } catch {
    return parsePreference(memoryValue);
  }
}

export async function setStoredLanguagePreference(
  preference: LanguagePreference,
): Promise<void> {
  memoryValue = preference;

  if (Platform.OS === "web") {
    webSet(preference);
    return;
  }

  const storage = await getNativeStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.setItem(STORAGE_KEY, preference);
  } catch {
    // Native module missing or write failed — memory fallback already set
  }
}
