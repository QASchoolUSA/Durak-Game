import { STARTING_CREDITS } from "./creditEconomy";
import { getNativeStorage } from "./nativeAsyncStorage";

const STORAGE_KEY = "@durak/creditBalance";

let memoryValue: number | null = null;

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

export async function getStoredCreditBalance(): Promise<number> {
  const storage = await getNativeStorage();
  if (storage) {
    try {
      const parsed = parseBalance(await storage.getItem(STORAGE_KEY));
      if (parsed !== null) return parsed;
    } catch {
      /* fall through */
    }
  }
  return webGet() ?? STARTING_CREDITS;
}

export async function setStoredCreditBalance(balance: number): Promise<void> {
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

export function resetCreditStorageCache(): void {
  memoryValue = null;
}
