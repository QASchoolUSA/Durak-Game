import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROBE_KEY = "@durak/storageProbe";

let ready = false;
let probe: Promise<boolean> | null = null;

async function runProbe(): Promise<boolean> {
  try {
    await AsyncStorage.getItem(PROBE_KEY);
    ready = true;
    return true;
  } catch {
    // A transient failure (e.g. a stale Expo Go graph not yet serving the
    // native module) must NOT latch — a later call may succeed once it loads.
    // Latching here previously routed every persisted value (onboarded flag,
    // name, wallet) to ephemeral memory for the whole session, so the Welcome
    // screen would reappear on the next launch.
    return false;
  } finally {
    probe = null;
  }
}

/**
 * AsyncStorage behind an availability probe, shared by all the `*Storage.ts`
 * persistence modules.
 *
 * Statically imported on purpose: a runtime `import()` of async-storage is
 * split into a lazily-fetched bundle segment in Expo Go, which fails with
 * "Requiring unknown module <id>" whenever the served graph goes stale.
 * Callers still get `null` (and fall back to memory/localStorage) if the
 * native module is genuinely unavailable, but a transient failure is retried
 * on the next call rather than disabling persistence for the whole session.
 */
export async function getNativeStorage(): Promise<typeof AsyncStorage | null> {
  if (ready) return AsyncStorage;
  if (Platform.OS === "web") return null;
  if (!probe) probe = runProbe();
  return (await probe) ? AsyncStorage : null;
}
