import { Platform } from "react-native";

const STORAGE_KEY = "@durak/cardDesign";

/** In-memory fallback when native AsyncStorage is unavailable. */
let memoryValue: string | null = null;

let nativeStorage: typeof import("@react-native-async-storage/async-storage").default | null =
  null;
let nativeChecked = false;
let nativeUsable = false;

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

async function getNativeStorage() {
  if (nativeChecked) {
    return nativeUsable ? nativeStorage : null;
  }
  nativeChecked = true;

  if (Platform.OS === "web") {
    nativeUsable = false;
    return null;
  }

  try {
    const mod = await import("@react-native-async-storage/async-storage");
    nativeStorage = mod.default;
    await nativeStorage.getItem(STORAGE_KEY);
    nativeUsable = true;
    return nativeStorage;
  } catch {
    nativeStorage = null;
    nativeUsable = false;
    return null;
  }
}

export async function getStoredCardDesign(): Promise<string | null> {
  if (Platform.OS === "web") {
    return webGet();
  }

  const storage = await getNativeStorage();
  if (!storage) {
    return memoryValue;
  }

  try {
    const value = await storage.getItem(STORAGE_KEY);
    memoryValue = value;
    return value;
  } catch {
    return memoryValue;
  }
}

/** Sync peek for boot — web localStorage or in-memory cache after a prior read/write. */
export function peekStoredCardDesignSync(): string | null {
  if (Platform.OS === "web") {
    return webGet();
  }
  return memoryValue;
}

export async function setStoredCardDesign(value: string): Promise<void> {
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
