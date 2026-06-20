import { type AppearanceId, isValidAppearanceId } from "../theme/appearanceThemes";

export interface GameConfig {
  numPlayers: number;
  variant: "podkidnoy" | "perevodnoy";
  throwInScope: "all" | "neighbor";
  playStyle: "standard" | "abilities";
  difficulty: "easy" | "medium" | "hard";
}

const KEYS = {
  playerName: "@durak/playerName",
  nameIsCustom: "@durak/nameIsCustom",
  onboarded: "@durak/onboarded",
  credits: "@durak/creditBalance",
  gold: "@durak/goldBalance",
  gameConfig: "@durak/gameConfig",
  cardDesign: "@durak/cardDesign",
  soundEnabled: "@durak/soundEnabled",
  hapticsEnabled: "@durak/hapticsEnabled",
  turnTimerSeconds: "@durak/turnTimerSeconds",
};

/** Turn-timer durations offered in Settings (seconds). Mirrors mobile TURN_SECONDS_OPTIONS. */
export const TURN_SECONDS_OPTIONS = [8, 10, 12, 15, 20, 30] as const;
export const DEFAULT_TURN_SECONDS = 12;

export const MAX_DISPLAY_NAME_LENGTH = 12;

export function normalizeDisplayName(name: string): string {
  return name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function generateGuestDisplayName(): string {
  const suffix = Math.floor(Math.random() * 900) + 100;
  return `Guest${suffix}`;
}

export const storage = {
  getCardDesign(): AppearanceId {
    try {
      const val = localStorage.getItem(KEYS.cardDesign);
      if (val && isValidAppearanceId(val)) return val;
    } catch {}
    return "green";
  },

  setCardDesign(val: AppearanceId) {
    try {
      localStorage.setItem(KEYS.cardDesign, val);
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },

  getPlayerName(): { name: string; isCustom: boolean } {
    try {
      const name = localStorage.getItem(KEYS.playerName);
      const isCustom = localStorage.getItem(KEYS.nameIsCustom) === "true";
      if (name) return { name: normalizeDisplayName(name), isCustom };
    } catch (e) {
      console.warn("Storage failed", e);
    }
    const guestName = generateGuestDisplayName();
    return { name: guestName, isCustom: false };
  },

  setPlayerName(name: string, isCustom: boolean) {
    try {
      const clean = normalizeDisplayName(name);
      localStorage.setItem(KEYS.playerName, clean);
      localStorage.setItem(KEYS.nameIsCustom, isCustom ? "true" : "false");
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },

  getOnboarded(): boolean {
    try {
      return localStorage.getItem(KEYS.onboarded) === "true";
    } catch {
      return false;
    }
  },

  setOnboarded(val: boolean) {
    try {
      localStorage.setItem(KEYS.onboarded, val ? "true" : "false");
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },

  getCreditBalance(): number {
    try {
      const val = localStorage.getItem(KEYS.credits);
      return val ? parseInt(val, 10) : 1000; // default 1000 credits
    } catch {
      return 1000;
    }
  },

  setCreditBalance(val: number) {
    try {
      localStorage.setItem(KEYS.credits, Math.max(0, val).toString());
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },

  getGoldBalance(): number {
    try {
      const val = localStorage.getItem(KEYS.gold);
      return val ? parseInt(val, 10) : 10; // default 10 gold
    } catch {
      return 10;
    }
  },

  setGoldBalance(val: number) {
    try {
      localStorage.setItem(KEYS.gold, Math.max(0, val).toString());
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },

  getGameConfig(): GameConfig {
    try {
      const val = localStorage.getItem(KEYS.gameConfig);
      if (val) return JSON.parse(val);
    } catch {}
    return {
      numPlayers: 2,
      variant: "podkidnoy",
      throwInScope: "all",
      playStyle: "standard",
      difficulty: "medium",
    };
  },

  setGameConfig(config: GameConfig) {
    try {
      localStorage.setItem(KEYS.gameConfig, JSON.stringify(config));
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },

  getSoundEnabled(): boolean {
    try {
      return localStorage.getItem(KEYS.soundEnabled) !== "false"; // default on
    } catch {
      return true;
    }
  },

  setSoundEnabled(val: boolean) {
    try {
      localStorage.setItem(KEYS.soundEnabled, val ? "true" : "false");
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },

  getHapticsEnabled(): boolean {
    try {
      return localStorage.getItem(KEYS.hapticsEnabled) !== "false"; // default on
    } catch {
      return true;
    }
  },

  setHapticsEnabled(val: boolean) {
    try {
      localStorage.setItem(KEYS.hapticsEnabled, val ? "true" : "false");
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },

  getTurnTimerSeconds(): number {
    try {
      const val = localStorage.getItem(KEYS.turnTimerSeconds);
      const n = val ? parseInt(val, 10) : DEFAULT_TURN_SECONDS;
      return (TURN_SECONDS_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_TURN_SECONDS;
    } catch {
      return DEFAULT_TURN_SECONDS;
    }
  },

  setTurnTimerSeconds(val: number) {
    try {
      localStorage.setItem(KEYS.turnTimerSeconds, String(val));
    } catch (e) {
      console.warn("Storage failed", e);
    }
  },
};
