import { create } from "zustand";
import {
  DEFAULT_APPEARANCE,
  type AppearanceId,
  resolveAppearanceId,
} from "../theme/appearanceThemes";
import type { CardDesignId } from "../theme/cardThemes";
import type { TableDesignId } from "../theme/tableThemes";
import { getStoredCardDesign, peekStoredCardDesignSync, setStoredCardDesign } from "./cardDesignStorage";
import { getStoredHapticsEnabled, setStoredHapticsEnabled } from "./hapticsStorage";
import { getStoredSoundEnabled, setStoredSoundEnabled } from "./soundStorage";
import { getStoredTableDesign, setStoredTableDesign } from "./tableDesignStorage";
import {
  DEFAULT_TURN_SECONDS,
  getStoredTurnSeconds,
  setStoredTurnSeconds,
  type TurnSecondsOption,
} from "./turnTimerStorage";
import {
  getStoredTutorialCompleted,
  setStoredTutorialCompleted,
} from "./tutorialStorage";

interface PreferencesStore {
  cardDesign: CardDesignId;
  tableDesign: TableDesignId;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  turnSeconds: TurnSecondsOption;
  tutorialCompleted: boolean;
  appearanceLoaded: boolean;
  hydrated: boolean;
  setAppearance: (id: AppearanceId) => void;
  setCardDesign: (id: CardDesignId) => void;
  setTableDesign: (id: TableDesignId) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setTurnSeconds: (seconds: TurnSecondsOption) => void;
  setTutorialCompleted: (completed: boolean) => void;
}

function syncAppearance(id: AppearanceId) {
  usePreferencesStore.setState({ cardDesign: id, tableDesign: id });
  void setStoredCardDesign(id);
  void setStoredTableDesign(id);
}

function initialAppearance(): AppearanceId {
  const peeked = peekStoredCardDesignSync();
  return peeked ? resolveAppearanceId(peeked) ?? DEFAULT_APPEARANCE : DEFAULT_APPEARANCE;
}

const bootAppearance = initialAppearance();

export const usePreferencesStore = create<PreferencesStore>(() => ({
  cardDesign: bootAppearance,
  tableDesign: bootAppearance,
  hapticsEnabled: true,
  soundEnabled: true,
  turnSeconds: DEFAULT_TURN_SECONDS,
  tutorialCompleted: false,
  appearanceLoaded: false,
  hydrated: false,
  setAppearance: (id) => {
    syncAppearance(id);
  },
  setCardDesign: (id) => {
    syncAppearance(id);
  },
  setTableDesign: (id) => {
    syncAppearance(id);
  },
  setHapticsEnabled: (enabled) => {
    usePreferencesStore.setState({ hapticsEnabled: enabled });
    void setStoredHapticsEnabled(enabled);
  },
  setSoundEnabled: (enabled) => {
    usePreferencesStore.setState({ soundEnabled: enabled });
    void setStoredSoundEnabled(enabled);
  },
  setTurnSeconds: (seconds) => {
    usePreferencesStore.setState({ turnSeconds: seconds });
    void setStoredTurnSeconds(seconds);
  },
  setTutorialCompleted: (completed) => {
    usePreferencesStore.setState({ tutorialCompleted: completed });
    void setStoredTutorialCompleted(completed);
  },
}));

async function loadAppearance(): Promise<void> {
  try {
    const [cardStored, tableStored] = await Promise.all([
      getStoredCardDesign(),
      getStoredTableDesign(),
    ]);
    const raw = cardStored ?? tableStored;
    const resolved = raw ? resolveAppearanceId(raw) : null;
    if (resolved) {
      syncAppearance(resolved);
      if (resolved !== cardStored) {
        void setStoredCardDesign(resolved);
      }
      if (resolved !== tableStored) {
        void setStoredTableDesign(resolved);
      }
    }
  } catch {
    // Fall through to boot defaults
  } finally {
    usePreferencesStore.setState({ appearanceLoaded: true });
  }
}

export async function loadCardDesign(): Promise<void> {
  try {
    const stored = await getStoredCardDesign();
    const resolved = stored ? resolveAppearanceId(stored) : null;
    if (resolved) {
      usePreferencesStore.setState({ cardDesign: resolved });
      if (resolved !== stored) {
        void setStoredCardDesign(resolved);
      }
    }
  } catch {
    // Fall through to default
  }
}

export async function loadTableDesign(): Promise<void> {
  try {
    const stored = await getStoredTableDesign();
    const resolved = stored ? resolveAppearanceId(stored) : null;
    if (resolved) {
      usePreferencesStore.setState({ tableDesign: resolved });
      if (resolved !== stored) {
        void setStoredTableDesign(resolved);
      }
    }
  } catch {
    // Fall through to default
  }
}

export async function loadHapticsEnabled(): Promise<void> {
  try {
    const stored = await getStoredHapticsEnabled();
    if (stored !== null) {
      usePreferencesStore.setState({ hapticsEnabled: stored });
    }
  } catch {
    // Fall through to default
  }
}

export async function loadSoundEnabled(): Promise<void> {
  try {
    const stored = await getStoredSoundEnabled();
    if (stored !== null) {
      usePreferencesStore.setState({ soundEnabled: stored });
    }
  } catch {
    // Fall through to default
  }
}

export async function loadTurnSeconds(): Promise<void> {
  try {
    const stored = await getStoredTurnSeconds();
    if (stored !== null) {
      usePreferencesStore.setState({ turnSeconds: stored });
    }
  } catch {
    // Fall through to default
  }
}

export async function loadTutorialCompleted(): Promise<void> {
  try {
    const completed = await getStoredTutorialCompleted();
    usePreferencesStore.setState({ tutorialCompleted: completed });
  } catch {
    // Fall through to default
  }
}

async function loadPreferencesImpl(): Promise<void> {
  try {
    await loadAppearance();
    await Promise.all([
      loadHapticsEnabled(),
      loadSoundEnabled(),
      loadTurnSeconds(),
      loadTutorialCompleted(),
    ]);
  } finally {
    usePreferencesStore.setState({ hydrated: true });
  }
}

let loadPreferencesPromise: Promise<void> | null = null;

export function loadPreferences(): Promise<void> {
  loadPreferencesPromise ??= loadPreferencesImpl();
  return loadPreferencesPromise;
}
