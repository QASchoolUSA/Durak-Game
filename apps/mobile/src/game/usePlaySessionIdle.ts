import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { convexEnabled } from "./convexClient";
import {
  clearPlaySession,
  isPlaySessionExpired,
  loadPlaySession,
  touchPlaySession,
} from "./onlineSessionStorage";
import { useGameStore } from "./store";

const TOUCH_INTERVAL_MS = 60_000;

async function expirePlaySessionOnline(
  forfeit: (args: { roomId: Id<"rooms"> }) => Promise<unknown>,
  leaveRoom: (args: { roomId: Id<"rooms"> }) => Promise<unknown>,
): Promise<void> {
  const { playMode, onlineRoomId, screen } = useGameStore.getState();

  if (playMode === "online" && onlineRoomId && convexEnabled) {
    const roomId = onlineRoomId as Id<"rooms">;
    try {
      if (screen === "game") {
        await forfeit({ roomId });
      } else {
        await leaveRoom({ roomId });
      }
    } catch {
      /* room may already be gone */
    }
  }

  useGameStore.getState().goHome();
  await clearPlaySession();
}

export function usePlaySessionIdle() {
  const screen = useGameStore((s) => s.screen);
  const playMode = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const onlineDisplayName = useGameStore((s) => s.onlineDisplayName);

  const forfeit = useMutation(api.rooms.forfeit);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const mountCheckedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (mountCheckedRef.current) return;
    mountCheckedRef.current = true;

    void (async () => {
      const session = await loadPlaySession();
      if (!isPlaySessionExpired(session)) return;
      await clearPlaySession();
      useGameStore.getState().goHome();
    })();
  }, []);

  useEffect(() => {
    if (screen === "home") return;

    const online =
      playMode === "online" && onlineRoomId
        ? { roomId: onlineRoomId, displayName: onlineDisplayName }
        : undefined;

    void touchPlaySession(online);

    const id = setInterval(() => {
      void touchPlaySession(online);
    }, TOUCH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [screen, playMode, onlineRoomId, onlineDisplayName]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      const resumed =
        nextState === "active" &&
        (prev === "background" || prev === "inactive");

      if (!resumed) return;

      void (async () => {
        const session = await loadPlaySession();
        if (!isPlaySessionExpired(session)) return;
        await expirePlaySessionOnline(forfeit, leaveRoom);
      })();
    });

    return () => sub.remove();
  }, [forfeit, leaveRoom]);
}
