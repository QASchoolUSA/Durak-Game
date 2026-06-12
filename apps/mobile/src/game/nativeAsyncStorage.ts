import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROBE_KEY = "@durak/storageProbe";

let checked = false;
let usable = false;

/**
 * AsyncStorage behind a one-time availability probe, shared by all the
 * `*Storage.ts` persistence modules.
 *
 * Statically imported on purpose: a runtime `import()` of async-storage is
 * split into a lazily-fetched bundle segment in Expo Go, which fails with
 * "Requiring unknown module <id>" whenever the served graph goes stale.
 * Callers still get `null` (and fall back to memory/localStorage) if the
 * native module is genuinely unavailable.
 */
export async function getNativeStorage(): Promise<typeof AsyncStorage | null> {
  if (checked) return usable ? AsyncStorage : null;
  checked = true;
  if (Platform.OS === "web") return null;
  try {
    await AsyncStorage.getItem(PROBE_KEY);
    usable = true;
    return AsyncStorage;
  } catch {
    return null;
  }
}
