import { create } from "zustand";
import {
  DEFAULT_CARD_DESIGN,
  type CardDesignId,
  resolveCardDesignId,
} from "../theme/cardThemes";
import { getStoredCardDesign, setStoredCardDesign } from "./cardDesignStorage";

interface PreferencesStore {
  cardDesign: CardDesignId;
  hydrated: boolean;
  setCardDesign: (id: CardDesignId) => void;
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  cardDesign: DEFAULT_CARD_DESIGN,
  hydrated: false,
  setCardDesign: (id) => {
    set({ cardDesign: id });
    void setStoredCardDesign(id);
  },
}));

export async function loadCardDesign(): Promise<void> {
  try {
    const stored = await getStoredCardDesign();
    const resolved = stored ? resolveCardDesignId(stored) : null;
    if (resolved) {
      usePreferencesStore.setState({ cardDesign: resolved, hydrated: true });
      if (resolved !== stored) {
        void setStoredCardDesign(resolved);
      }
      return;
    }
  } catch {
    // Fall through to default
  }
  usePreferencesStore.setState({ hydrated: true });
}
