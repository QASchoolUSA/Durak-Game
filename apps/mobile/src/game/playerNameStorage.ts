import { Platform } from "react-native";

const STORAGE_KEY = "@durak/playerDisplayName";
const MAX_NAME_LENGTH = 20;

let memoryValue: string | null = null;

let nativeStorage: typeof import("@react-native-async-storage/async-storage").default | null =
  null;
let nativeChecked = false;
let nativeUsable = false;

function normalizeName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

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
    // Ignore quota / privacy errors
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

export async function getStoredPlayerName(): Promise<string | null> {
  let raw: string | null;
  if (Platform.OS === "web") {
    raw = webGet();
  } else {
    const storage = await getNativeStorage();
    if (!storage) {
      raw = memoryValue;
    } else {
      try {
        raw = await storage.getItem(STORAGE_KEY);
        memoryValue = raw;
      } catch {
        raw = memoryValue;
      }
    }
  }
  if (!raw) return null;
  const normalized = normalizeName(raw);
  return normalized.length > 0 ? normalized : null;
}

export async function setStoredPlayerName(name: string): Promise<void> {
  const normalized = normalizeName(name);
  if (normalized.length === 0) return;

  memoryValue = normalized;
  if (Platform.OS === "web") {
    webSet(normalized);
    return;
  }
  const storage = await getNativeStorage();
  if (!storage) return;
  try {
    await storage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Native module missing or write failed
  }
}
