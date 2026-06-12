import { Platform } from "react-native";
import {
  DEFAULT_TURN_SECONDS,
  normalizeTurnSeconds,
  VALID_TURN_SECONDS,
  type TurnSecondsOption,
} from "@durak/game-core";

import { getNativeStorage } from "./nativeAsyncStorage";

const STORAGE_KEY = "@durak/turnSeconds";

export type { TurnSecondsOption };
export const TURN_SECONDS_OPTIONS: TurnSecondsOption[] = [...VALID_TURN_SECONDS];
export { DEFAULT_TURN_SECONDS };

let memoryValue: string | null = null;

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

function parseTurnSeconds(raw: string | null): TurnSecondsOption | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const normalized = normalizeTurnSeconds(n);
  if ((VALID_TURN_SECONDS as readonly number[]).includes(n)) {
    return normalized;
  }
  // Legacy 0 / 60 / invalid — migrate on read
  if (raw !== String(normalized)) {
    void setStoredTurnSeconds(normalized);
  }
  return normalized;
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
  return `${seconds}s`;
}
