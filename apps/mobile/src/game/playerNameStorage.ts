import { Platform } from "react-native";

const STORAGE_KEY = "@durak/playerDisplayName";
const CUSTOM_FLAG_KEY = "@durak/displayNameIsCustom";
export const MAX_DISPLAY_NAME_LENGTH = 12;

function normalizeName(name: string): string {
  return name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function normalizeDisplayName(name: string): string {
  return normalizeName(name);
}

const GUEST_NAME_POOL = ["Olga", "Ivan", "Dmitri", "Maria", "Sergey"];

let memoryValue: string | null = null;
let memoryIsCustom: boolean | null = null;

let nativeStorage: typeof import("@react-native-async-storage/async-storage").default | null =
  null;
let nativeChecked = false;
let nativeUsable = false;

function webGet(key: string): string | null {
  if (typeof localStorage === "undefined") {
    if (key === STORAGE_KEY) return memoryValue;
    if (key === CUSTOM_FLAG_KEY) {
      return memoryIsCustom === null ? null : memoryIsCustom ? "true" : "false";
    }
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
  if (key === CUSTOM_FLAG_KEY) memoryIsCustom = value === "true";
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
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

async function readItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return webGet(key);
  const storage = await getNativeStorage();
  if (!storage) {
    if (key === STORAGE_KEY) return memoryValue;
    if (key === CUSTOM_FLAG_KEY) {
      return memoryIsCustom === null ? null : memoryIsCustom ? "true" : "false";
    }
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
  if (key === CUSTOM_FLAG_KEY) memoryIsCustom = value === "true";
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
  const base = GUEST_NAME_POOL[Math.floor(Math.random() * GUEST_NAME_POOL.length)]!;
  const suffix = Math.floor(Math.random() * 900) + 100;
  return normalizeName(`${base}${suffix}`);
}

export async function getStoredPlayerName(): Promise<string | null> {
  const raw = await readItem(STORAGE_KEY);
  if (!raw) return null;
  const normalized = normalizeName(raw);
  return normalized.length > 0 ? normalized : null;
}

/** Default true when a name exists but the flag was never written (migration). */
export async function getStoredNameIsCustom(): Promise<boolean> {
  const stored = await getStoredPlayerName();
  const raw = await readItem(CUSTOM_FLAG_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return stored != null;
}

async function persistDisplayName(name: string, isCustom: boolean): Promise<void> {
  const normalized = normalizeName(name);
  if (normalized.length === 0) return;
  await writeItem(STORAGE_KEY, normalized);
  await writeItem(CUSTOM_FLAG_KEY, isCustom ? "true" : "false");
}

export async function setStoredGuestName(name: string): Promise<void> {
  await persistDisplayName(name, false);
}

export async function setStoredCustomName(name: string): Promise<void> {
  await persistDisplayName(name, true);
}

/** Clears in-memory cache after a full storage wipe (dev/testing). */
export function resetPlayerNameStorageCache(): void {
  memoryValue = null;
  memoryIsCustom = null;
}

/** @deprecated Use setStoredGuestName or setStoredCustomName */
export async function setStoredPlayerName(name: string): Promise<void> {
  await setStoredCustomName(name);
}
