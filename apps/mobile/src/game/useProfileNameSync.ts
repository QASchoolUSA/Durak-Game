import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGameStore } from "./store";
import { normalizeDisplayName } from "./playerNameStorage";

/**
 * Keeps the local display name and the Convex profile consistent.
 * Priority: custom name (Settings) > profile @handle > Guest###.
 *
 * - When a handle exists and no custom name is set, the handle becomes the
 *   in-game display name (adopted locally + pushed to any active room).
 * - When a custom name is set, it's pushed onto the profile so friends and
 *   invites show it too.
 */
export function useProfileNameSync(): void {
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.profiles.getMyProfile,
    isAuthenticated ? {} : "skip",
  );
  const updateMyDisplayName = useMutation(api.profiles.updateMyDisplayName);

  const playerNameHydrated = useGameStore((s) => s.playerNameHydrated);
  const hasCustomDisplayName = useGameStore((s) => s.hasCustomDisplayName);
  const onlineDisplayName = useGameStore((s) => s.onlineDisplayName);

  // Adopt the handle as the in-game name when no custom name is set.
  useEffect(() => {
    if (!playerNameHydrated || hasCustomDisplayName) return;
    if (!profile?.handle) return;
    const target = normalizeDisplayName(profile.handle);
    if (!target || onlineDisplayName === target) return;
    useGameStore.getState().adoptHandleDisplayName(profile.handle);
  }, [playerNameHydrated, hasCustomDisplayName, profile, onlineDisplayName]);

  // Push a custom name onto the profile so friends see it.
  const lastPushedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!playerNameHydrated || !hasCustomDisplayName || !profile) return;
    if (normalizeDisplayName(profile.displayName) === onlineDisplayName) return;
    if (lastPushedRef.current === onlineDisplayName) return;
    lastPushedRef.current = onlineDisplayName;
    void updateMyDisplayName({ displayName: onlineDisplayName }).catch(() => {
      lastPushedRef.current = null;
    });
  }, [
    playerNameHydrated,
    hasCustomDisplayName,
    profile,
    onlineDisplayName,
    updateMyDisplayName,
  ]);
}
