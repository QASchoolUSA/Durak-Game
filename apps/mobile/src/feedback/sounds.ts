import { Platform } from "react-native";
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

type AudioPlayer = import("expo-audio").AudioPlayer;

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

const SOURCES: Record<SoundKey, number> = {
  tap: require("../../assets/sounds/tap.wav"),
  confirm: require("../../assets/sounds/confirm.wav"),
  cardPlay: require("../../assets/sounds/card-play.wav"),
  take: require("../../assets/sounds/take.wav"),
  gameStart: require("../../assets/sounds/game-start.wav"),
  success: require("../../assets/sounds/success.wav"),
  failure: require("../../assets/sounds/failure.wav"),
  tick: require("../../assets/sounds/tick.wav"),
  roundClear: require("../../assets/sounds/round-clear.wav"),
  deal: require("../../assets/sounds/deal.wav"),
  turnStart: require("../../assets/sounds/turn-start.wav"),
};

/** Per-clip volume — new moment sounds stay quieter than core UI feedback. */
const KEY_VOLUME: Partial<Record<SoundKey, number>> = {
  roundClear: 0.55,
  deal: 0.6,
  turnStart: 0.45,
};

type AudioModule = typeof import("expo-audio");

let audioState: "unknown" | "available" | "unavailable" = "unknown";
let audioMod: AudioModule | null = null;
let modeConfigured = false;
const playerPool = new Map<SoundKey, AudioPlayer>();

async function loadAudioModule(): Promise<AudioModule | null> {
  if (audioState === "unavailable") return null;
  if (audioMod) return audioMod;

  try {
    const mod = await import("expo-audio");
    if (!modeConfigured) {
      await mod.setAudioModeAsync({ playsInSilentMode: true });
      modeConfigured = true;
    }
    audioMod = mod;
    audioState = "available";
    return mod;
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
    player = mod.createAudioPlayer(SOURCES[key]);
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

/** Fire a sound for a feedback event if enabled and supported. */
export function playSound(event: HapticEvent): void {
  if (Platform.OS === "web") return;
  if (!usePreferencesStore.getState().soundEnabled) return;

  const key = EVENT_SOUND[event];
  if (!key) return;

  void playKey(key).catch(() => {
    audioState = "unavailable";
    audioMod = null;
    playerPool.clear();
  });
}
