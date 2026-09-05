import { Platform } from "react-native";
import { getNativeStorage } from "./nativeAsyncStorage";

const STORAGE_KEY = "@durak/playerDisplayName";
/** Legacy custom-name flag — cleared on write; ignored on read. */
const CUSTOM_FLAG_KEY = "@durak/displayNameIsCustom";
export const MAX_DISPLAY_NAME_LENGTH = 20;

function normalizeName(name: string): string {
  return name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function normalizeDisplayName(name: string): string {
  return normalizeName(name);
}

// Shape of names produced by the old pool-based guest generator; used to
// migrate them to Guest### on load.
const LEGACY_GUEST_NAME_RE = /^(Olga|Ivan|Dmitri|Maria|Sergey)\d{3}$/;

export function isLegacyGuestName(name: string): boolean {
  return LEGACY_GUEST_NAME_RE.test(name);
}

let memoryValue: string | null = null;

function webGet(key: string): string | null {
  if (typeof localStorage === "undefined") {
    if (key === STORAGE_KEY) return memoryValue;
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    if (key === STORAGE_KEY) return memoryValue;
    return null;
  }
}

function webSet(key: string, value: string): void {
  if (key === STORAGE_KEY) memoryValue = value;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota / privacy errors
  }
}

async function readItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return webGet(key);
  const storage = await getNativeStorage();
  if (!storage) {
    if (key === STORAGE_KEY) return memoryValue;
    return null;
  }
  try {
    return await storage.getItem(key);
  } catch {
    if (key === STORAGE_KEY) return memoryValue;
    return null;
  }
}

async function writeItem(key: string, value: string): Promise<void> {
  if (key === STORAGE_KEY) memoryValue = value;
  if (Platform.OS === "web") {
    webSet(key, value);
    return;
  }
  const storage = await getNativeStorage();
  if (!storage) return;
  try {
    await storage.setItem(key, value);
  } catch {
    // Native module missing or write failed
  }
}

export function generateGuestDisplayName(): string {
  const suffix = Math.floor(Math.random() * 900) + 100;
  return normalizeName(`Guest${suffix}`);
}

export async function getStoredPlayerName(): Promise<string | null> {
  const raw = await readItem(STORAGE_KEY);
  if (!raw) return null;
  const normalized = normalizeName(raw);
  return normalized.length > 0 ? normalized : null;
}

/** Persist seat name (handle for registered users, Guest### for guests). */
export async function setStoredPlayerName(name: string): Promise<void> {
  const normalized = normalizeName(name);
  if (normalized.length === 0) return;
  await writeItem(STORAGE_KEY, normalized);
  // Drop legacy custom flag so old Settings nicknames don't stick.
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(CUSTOM_FLAG_KEY);
    } catch {
      /* ignore */
    }
  } else {
    const storage = await getNativeStorage();
    try {
      await storage?.removeItem(CUSTOM_FLAG_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** @deprecated Use setStoredPlayerName */
export async function setStoredGuestName(name: string): Promise<void> {
  await setStoredPlayerName(name);
}

/** @deprecated Use setStoredPlayerName */
export async function setStoredCustomName(name: string): Promise<void> {
  await setStoredPlayerName(name);
}

/** Clears in-memory cache after a full storage wipe (dev/testing). */
export function resetPlayerNameStorageCache(): void {
  memoryValue = null;
}
