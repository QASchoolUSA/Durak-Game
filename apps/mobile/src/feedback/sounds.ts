import { Platform } from "react-native";
// Statically imported: a runtime `import("expo-audio")` becomes a lazy Metro
// segment that can fail in Expo Go ("Requiring unknown module"). Player
// instances and clip assets are still created lazily on first play.
import * as ExpoAudio from "expo-audio";
import type { HapticEvent } from "./haptics";
import { usePreferencesStore } from "../game/preferencesStore";

type SoundKey =
  | "tap"
  | "confirm"
  | "cardPlay"
  | "take"
  | "gameStart"
  | "success"
  | "failure"
  | "tick"
  | "roundClear"
  | "deal"
  | "turnStart";

type AudioPlayer = ExpoAudio.AudioPlayer;

const EVENT_SOUND: Partial<Record<HapticEvent, SoundKey>> = {
  uiTap: "tap",
  selection: "tap",
  confirm: "confirm",
  cardPlay: "cardPlay",
  takeCards: "take",
  gameStart: "gameStart",
  roundClear: "roundClear",
  deal: "deal",
  turnStart: "turnStart",
  timerWarning: "tick",
  timerCritical: "tick",
  timerExpired: "confirm",
  success: "success",
  failure: "failure",
  error: "failure",
};

/** Loaded on first play or prewarm — keeps cold start lighter than eager requires. */
function loadSource(key: SoundKey): number {
  switch (key) {
    case "tap":
      return require("../../assets/sounds/tap.wav");
    case "confirm":
      return require("../../assets/sounds/confirm.wav");
    case "cardPlay":
      return require("../../assets/sounds/card-play.wav");
    case "take":
      return require("../../assets/sounds/take.wav");
    case "gameStart":
      return require("../../assets/sounds/game-start.wav");
    case "success":
      return require("../../assets/sounds/success.wav");
    case "failure":
      return require("../../assets/sounds/failure.wav");
    case "tick":
      return require("../../assets/sounds/tick.wav");
    case "roundClear":
      return require("../../assets/sounds/round-clear.wav");
    case "deal":
      return require("../../assets/sounds/deal.wav");
    case "turnStart":
      return require("../../assets/sounds/turn-start.wav");
  }
}

const KEY_VOLUME: Partial<Record<SoundKey, number>> = {
  roundClear: 0.55,
  deal: 0.6,
  turnStart: 0.45,
};

type AudioModule = typeof ExpoAudio;

let audioState: "unknown" | "available" | "unavailable" = "unknown";
let modeConfigured = false;
const playerPool = new Map<SoundKey, AudioPlayer>();

async function loadAudioModule(): Promise<AudioModule | null> {
  if (audioState === "unavailable") return null;
  if (audioState === "available") return ExpoAudio;

  try {
    if (!modeConfigured) {
      await ExpoAudio.setAudioModeAsync({ playsInSilentMode: true });
      modeConfigured = true;
    }
    audioState = "available";
    return ExpoAudio;
  } catch {
    audioState = "unavailable";
    return null;
  }
}

async function playKey(key: SoundKey): Promise<void> {
  const mod = await loadAudioModule();
  if (!mod) return;

  let player = playerPool.get(key);
  if (!player) {
    player = mod.createAudioPlayer(loadSource(key));
    player.volume = KEY_VOLUME[key] ?? 0.85;
    playerPool.set(key, player);
  }

  try {
    await player.seekTo(0);
  } catch {
    // seekTo can fail before the clip is fully loaded — play anyway.
  }
  player.play();
}

/** Warm audio module and common clips before first card play. */
export async function prewarmSounds(): Promise<void> {
  if (Platform.OS === "web") return;
  const mod = await loadAudioModule();
  if (!mod) return;
  for (const key of ["tap", "cardPlay", "confirm"] as const) {
    if (!playerPool.has(key)) {
      const player = mod.createAudioPlayer(loadSource(key));
      player.volume = KEY_VOLUME[key] ?? 0.85;
      playerPool.set(key, player);
    }
  }
}

/** Fire a sound for a feedback event if enabled and supported. */
export function playSound(event: HapticEvent): void {
  if (Platform.OS === "web") return;
  if (!usePreferencesStore.getState().soundEnabled) return;

  const key = EVENT_SOUND[event];
  if (!key) return;

  void playKey(key).catch(() => {
    audioState = "unavailable";
    playerPool.clear();
  });
}
