import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGameStore } from "./store";
import { normalizeDisplayName } from "./playerNameStorage";

/**
 * When a registered profile handle exists, adopt it as the in-game seat name
 * (and push it into any active room via adoptHandleDisplayName).
 */
export function useProfileNameSync(): void {
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.profiles.getMyProfile,
    isAuthenticated ? {} : "skip",
  );

  const playerNameHydrated = useGameStore((s) => s.playerNameHydrated);
  const onlineDisplayName = useGameStore((s) => s.onlineDisplayName);

  useEffect(() => {
    if (!playerNameHydrated) return;
    if (!profile?.handle) return;
    const target = normalizeDisplayName(profile.handle);
    if (!target || onlineDisplayName === target) return;
    useGameStore.getState().adoptHandleDisplayName(profile.handle);
  }, [playerNameHydrated, profile, onlineDisplayName]);
}
