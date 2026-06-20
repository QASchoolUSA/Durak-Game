import { storage } from "../store/storage";

/**
 * Web feedback engine: low-latency sound effects (Web Audio API) + vibration
 * haptics. Mirrors the event mapping in apps/mobile/src/feedback/{sounds,haptics}.ts
 * but plays the same WAV assets (copied to /public/sounds) decoded into pooled buffers.
 */

export type FeedbackEvent =
  | "uiTap"
  | "selection"
  | "confirm"
  | "gameStart"
  | "cardPlay"
  | "takeCards"
  | "roundClear"
  | "deal"
  | "turnStart"
  | "timerWarning"
  | "timerCritical"
  | "timerExpired"
  | "success"
  | "failure"
  | "error";

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

const EVENT_SOUND: Partial<Record<FeedbackEvent, SoundKey>> = {
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

const SOUND_FILE: Record<SoundKey, string> = {
  tap: "/sounds/tap.wav",
  confirm: "/sounds/confirm.wav",
  cardPlay: "/sounds/card-play.wav",
  take: "/sounds/take.wav",
  gameStart: "/sounds/game-start.wav",
  success: "/sounds/success.wav",
  failure: "/sounds/failure.wav",
  tick: "/sounds/tick.wav",
  roundClear: "/sounds/round-clear.wav",
  deal: "/sounds/deal.wav",
  turnStart: "/sounds/turn-start.wav",
};

const KEY_VOLUME: Partial<Record<SoundKey, number>> = {
  roundClear: 0.55,
  deal: 0.6,
  turnStart: 0.45,
};

/** Vibration patterns (ms) per event; undefined = no vibration. */
const EVENT_VIBRATION: Partial<Record<FeedbackEvent, number | number[]>> = {
  uiTap: 8,
  selection: 8,
  confirm: 15,
  cardPlay: 15,
  gameStart: 30,
  takeCards: [0, 20, 40, 20],
  roundClear: 12,
  turnStart: 10,
  timerWarning: 10,
  timerCritical: 20,
  timerExpired: 30,
  success: [0, 25, 40, 25],
  failure: [0, 40, 60, 40],
  error: [0, 40, 60, 40],
};

// --- preferences (persisted; default on) ---
let soundEnabled = storage.getSoundEnabled();
let hapticsEnabled = storage.getHapticsEnabled();

export function isSoundEnabled(): boolean {
  return soundEnabled;
}
export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}
export function setSoundEnabled(value: boolean): void {
  soundEnabled = value;
  storage.setSoundEnabled(value);
  if (value) void unlockAudio();
}
export function setHapticsEnabled(value: boolean): void {
  hapticsEnabled = value;
  storage.setHapticsEnabled(value);
}

// --- Web Audio ---
let ctx: AudioContext | null = null;
const buffers = new Map<SoundKey, AudioBuffer>();
const pending = new Map<SoundKey, Promise<AudioBuffer | null>>();

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Browsers suspend AudioContext until a user gesture — call this from a click/keydown. */
export async function unlockAudio(): Promise<void> {
  const c = getCtx();
  if (c && c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }
}

async function loadBuffer(key: SoundKey): Promise<AudioBuffer | null> {
  if (buffers.has(key)) return buffers.get(key)!;
  if (pending.has(key)) return pending.get(key)!;
  const c = getCtx();
  if (!c) return null;

  const p = (async () => {
    try {
      const res = await fetch(SOUND_FILE[key]);
      const arr = await res.arrayBuffer();
      const buf = await c.decodeAudioData(arr);
      buffers.set(key, buf);
      return buf;
    } catch {
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, p);
  return p;
}

function playKey(key: SoundKey): void {
  const c = getCtx();
  if (!c) return;
  void loadBuffer(key).then((buf) => {
    if (!buf || !ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = KEY_VOLUME[key] ?? 0.85;
    src.connect(gain).connect(ctx.destination);
    try {
      src.start(0);
    } catch {
      /* ignore */
    }
  });
}

/** Warm the AudioContext and a couple of common clips after the first gesture. */
export function prewarmSounds(): void {
  if (!soundEnabled) return;
  void unlockAudio();
  void loadBuffer("cardPlay");
  void loadBuffer("tap");
}

/** Fire haptic + sound feedback for an event, honoring user preferences. */
export function trigger(event: FeedbackEvent): void {
  if (soundEnabled) {
    const key = EVENT_SOUND[event];
    if (key) playKey(key);
  }
  if (hapticsEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
    const pattern = EVENT_VIBRATION[event];
    if (pattern !== undefined) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* ignore */
      }
    }
  }
}
