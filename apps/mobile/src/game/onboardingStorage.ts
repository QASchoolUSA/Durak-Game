import { Platform } from "react-native";

const STORAGE_KEY = "@durak/onboarded";

let memoryValue: boolean | null = null;
let nativeStorage: typeof import("@react-native-async-storage/async-storage").default | null =
  null;
let nativeChecked = false;
let nativeUsable = false;

function webGet(): boolean | null {
  if (typeof localStorage === "undefined") return memoryValue;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : raw === "1";
  } catch {
    return memoryValue;
  }
}

function webSet(value: boolean): void {
  memoryValue = value;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
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
    nativeUsable = false;
    return null;
  }
}

export async function getStoredOnboarded(): Promise<boolean> {
  const storage = await getNativeStorage();
  if (storage) {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw !== null) return raw === "1";
    } catch {
      /* fall through */
    }
  }
  return webGet() ?? false;
}

export async function setStoredOnboarded(value: boolean): Promise<void> {
  const storage = await getNativeStorage();
  if (storage) {
    try {
      await storage.setItem(STORAGE_KEY, value ? "1" : "0");
      return;
    } catch {
      /* fall through */
    }
  }
  webSet(value);
}
