import { Platform } from "react-native";
import type { GameVariant, PlayStyle, ThrowInScope } from "@durak/game-core";
import type { Difficulty } from "./store";

const STORAGE_KEY = "@durak/gameConfig";

export interface StoredGameConfig {
  numPlayers: number;
  variant: GameVariant;
  throwInScope: ThrowInScope;
  playStyle: PlayStyle;
  difficulty: Difficulty;
}

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

async function readRaw(): Promise<string | null> {
  if (Platform.OS === "web") return webGet();
  const storage = await getNativeStorage();
  if (!storage) return memoryValue;
  try {
    const value = await storage.getItem(STORAGE_KEY);
    memoryValue = value;
    return value;
  } catch {
    return memoryValue;
  }
}

async function writeRaw(value: string): Promise<void> {
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
    // Native module missing or write failed
  }
}

const VALID_VARIANTS: GameVariant[] = ["podkidnoy", "perevodnoy"];
const VALID_THROW_IN: ThrowInScope[] = ["all", "neighbor"];
const VALID_PLAY_STYLE: PlayStyle[] = ["standard", "abilities"];
const VALID_DIFFICULTY: Difficulty[] = ["easy", "medium", "hard"];

function parseConfig(raw: string): StoredGameConfig | null {
  try {
    const data = JSON.parse(raw) as Partial<StoredGameConfig>;
    if (
      typeof data.numPlayers !== "number" ||
      !VALID_VARIANTS.includes(data.variant as GameVariant) ||
      !VALID_THROW_IN.includes(data.throwInScope as ThrowInScope) ||
      !VALID_PLAY_STYLE.includes(data.playStyle as PlayStyle) ||
      !VALID_DIFFICULTY.includes(data.difficulty as Difficulty)
    ) {
      return null;
    }
    return {
      numPlayers: Math.min(6, Math.max(2, Math.round(data.numPlayers))),
      variant: data.variant as GameVariant,
      throwInScope: data.throwInScope as ThrowInScope,
      playStyle: data.playStyle as PlayStyle,
      difficulty: data.difficulty as Difficulty,
    };
  } catch {
    return null;
  }
}

export async function getStoredGameConfig(): Promise<StoredGameConfig | null> {
  const raw = await readRaw();
  if (!raw) return null;
  return parseConfig(raw);
}

export async function setStoredGameConfig(config: StoredGameConfig): Promise<void> {
  await writeRaw(JSON.stringify(config));
}
