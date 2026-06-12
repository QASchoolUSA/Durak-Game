import { getNativeStorage } from "./nativeAsyncStorage";

const STORAGE_KEY = "@durak/onboarded";

let memoryValue: boolean | null = null;

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
