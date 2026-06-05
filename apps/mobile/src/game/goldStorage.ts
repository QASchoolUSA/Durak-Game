import { Platform } from "react-native";
import { STARTING_GOLD } from "./goldEconomy";

const STORAGE_KEY = "@durak/goldCoins";

let memoryValue: number | null = null;
let nativeStorage: typeof import("@react-native-async-storage/async-storage").default | null =
  null;
let nativeChecked = false;
let nativeUsable = false;

function parseBalance(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function webGet(): number | null {
  if (typeof localStorage === "undefined") {
    return memoryValue;
  }
  try {
    return parseBalance(localStorage.getItem(STORAGE_KEY));
  } catch {
    return memoryValue;
  }
}

function webSet(value: number): void {
  memoryValue = value;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
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

export async function getStoredGoldBalance(): Promise<number> {
  const storage = await getNativeStorage();
  if (storage) {
    try {
      const parsed = parseBalance(await storage.getItem(STORAGE_KEY));
      if (parsed !== null) return parsed;
    } catch {
      /* fall through */
    }
  }
  return webGet() ?? STARTING_GOLD;
}

export async function setStoredGoldBalance(balance: number): Promise<void> {
  const safe = Math.max(0, Math.floor(balance));
  const storage = await getNativeStorage();
  if (storage) {
    try {
      await storage.setItem(STORAGE_KEY, String(safe));
      return;
    } catch {
      /* fall through */
    }
  }
  webSet(safe);
}

export function resetGoldStorageCache(): void {
  memoryValue = null;
}
