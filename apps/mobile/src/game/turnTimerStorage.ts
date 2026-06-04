import { Platform } from "react-native";

const STORAGE_KEY = "@durak/turnSeconds";

/** 0 = timer off; otherwise seconds per turn. */
export type TurnSecondsOption = 0 | 12 | 15 | 30 | 60;

export const TURN_SECONDS_OPTIONS: TurnSecondsOption[] = [0, 12, 15, 30, 60];
export const DEFAULT_TURN_SECONDS: TurnSecondsOption = 12;

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

function parseTurnSeconds(raw: string | null): TurnSecondsOption | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (TURN_SECONDS_OPTIONS.includes(n as TurnSecondsOption)) {
    return n as TurnSecondsOption;
  }
  return null;
}

export async function getStoredTurnSeconds(): Promise<TurnSecondsOption | null> {
  if (Platform.OS === "web") {
    return parseTurnSeconds(webGet());
  }
  const storage = await getNativeStorage();
  if (!storage) return parseTurnSeconds(memoryValue);
  try {
    const value = await storage.getItem(STORAGE_KEY);
    memoryValue = value;
    return parseTurnSeconds(value);
  } catch {
    return parseTurnSeconds(memoryValue);
  }
}

export async function setStoredTurnSeconds(seconds: TurnSecondsOption): Promise<void> {
  const value = String(seconds);
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

export function turnSecondsLabel(seconds: TurnSecondsOption): string {
  if (seconds === 0) return "Off";
  return `${seconds}s`;
}
