import { create } from "zustand";
import {
  DEFAULT_APPEARANCE,
  type AppearanceId,
  resolveAppearanceId,
} from "../theme/appearanceThemes";
import type { CardDesignId } from "../theme/cardThemes";
import type { TableDesignId } from "../theme/tableThemes";
import { getStoredCardDesign, setStoredCardDesign } from "./cardDesignStorage";
import { getStoredTableDesign, setStoredTableDesign } from "./tableDesignStorage";

interface PreferencesStore {
  cardDesign: CardDesignId;
  tableDesign: TableDesignId;
  hydrated: boolean;
  setAppearance: (id: AppearanceId) => void;
  setCardDesign: (id: CardDesignId) => void;
  setTableDesign: (id: TableDesignId) => void;
}

function syncAppearance(id: AppearanceId) {
  usePreferencesStore.setState({ cardDesign: id, tableDesign: id });
  void setStoredCardDesign(id);
  void setStoredTableDesign(id);
}

export const usePreferencesStore = create<PreferencesStore>(() => ({
  cardDesign: DEFAULT_APPEARANCE,
  tableDesign: DEFAULT_APPEARANCE,
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
}));

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

export async function loadPreferences(): Promise<void> {
  await Promise.all([loadCardDesign(), loadTableDesign()]);

  const { cardDesign, tableDesign } = usePreferencesStore.getState();
  const appearance = cardDesign === tableDesign ? cardDesign : cardDesign;

  if (appearance !== cardDesign || appearance !== tableDesign) {
    syncAppearance(appearance);
  }

  usePreferencesStore.setState({ hydrated: true });
}
