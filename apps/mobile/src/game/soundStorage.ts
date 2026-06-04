import { Platform } from "react-native";

const STORAGE_KEY = "@durak/soundEnabled";

let memoryValue: string | null = null;

let nativeStorage: typeof import("@react-native-async-storage/async-storage").default | null =
  null;
let nativeChecked = false;
let nativeUsable = false;

function webGet(): string | null {
  if (typeof localStorage === "undefined") return memoryValue;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryValue;
  }
}

function webSet(value: string): void {
  memoryValue = value;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore
  }
}

async function getNativeStorage() {
  if (nativeChecked) return nativeUsable ? nativeStorage : null;
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

export async function getStoredSoundEnabled(): Promise<boolean | null> {
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

export async function setStoredSoundEnabled(enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";
  memoryValue = value;
  if (Platform.OS === "web") {
    webSet(value);
    return;
  }
  const storage = await getNativeStorage();
  if (!storage) return;
  try {
    await storage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore
  }
}
