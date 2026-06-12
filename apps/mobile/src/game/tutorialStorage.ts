import { Platform } from "react-native";
import { getNativeStorage } from "./nativeAsyncStorage";

const STORAGE_KEY = "@durak/tutorialCompleted";

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

export async function getStoredTutorialCompleted(): Promise<boolean> {
  if (Platform.OS === "web") {
    return webGet() === "true";
  }
  const storage = await getNativeStorage();
  if (!storage) return memoryValue === "true";
  try {
    const value = await storage.getItem(STORAGE_KEY);
    memoryValue = value;
    return value === "true";
  } catch {
    return memoryValue === "true";
  }
}

export async function setStoredTutorialCompleted(completed: boolean): Promise<void> {
  const value = completed ? "true" : "false";
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
