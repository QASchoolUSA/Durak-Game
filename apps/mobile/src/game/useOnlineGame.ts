import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { registerOnlineMoveSubmit } from "./onlineBridge";
import { loadRoomSession, saveRoomSession } from "./onlineSessionStorage";
import { useGameStore } from "./store";

export function useOnlineGame() {
  const playMode = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const onlineSessionToken = useGameStore((s) => s.onlineSessionToken);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);
  const syncOnlineState = useGameStore((s) => s.syncOnlineState);
  const goHome = useGameStore((s) => s.goHome);

  const submitMove = useMutation(api.rooms.submitMove);

  const roomView = useQuery(
    api.rooms.getRoomView,
    playMode === "online" && onlineRoomId && onlineSessionToken
      ? {
          roomId: onlineRoomId as Id<"rooms">,
          sessionToken: onlineSessionToken,
        }
      : "skip",
  );

  useEffect(() => {
    if (playMode !== "online" || !onlineRoomId) return;

    registerOnlineMoveSubmit((move) => {
      if (!onlineRoomId || !onlineSessionToken) return;
      void submitMove({
        roomId: onlineRoomId as Id<"rooms">,
        sessionToken: onlineSessionToken,
        move,
      }).catch(() => {
        /* server rejected — query will resync */
      });
    });

    return () => registerOnlineMoveSubmit(null);
  }, [playMode, onlineRoomId, onlineSessionToken, submitMove]);

  useEffect(() => {
    if (roomView) {
      syncOnlineState(roomView);
    }
  }, [roomView, syncOnlineState]);

  useEffect(() => {
    void (async () => {
      const stored = await loadRoomSession();
      if (!stored) return;
      if (useGameStore.getState().onlineRoomId) return;
      enterOnlineLobby({
        roomId: stored.roomId,
        sessionToken: stored.sessionToken,
        displayName: stored.displayName,
        code: "",
        isHost: false,
      });
    })();
  }, [enterOnlineLobby]);

  useEffect(() => {
    if (roomView === null && playMode === "online" && onlineRoomId) {
      goHome();
    }
  }, [roomView, playMode, onlineRoomId, goHome]);

  useEffect(() => {
    if (playMode === "online" && onlineRoomId && onlineSessionToken) {
      const name = useGameStore.getState().onlineDisplayName;
      void saveRoomSession({
        roomId: onlineRoomId,
        sessionToken: onlineSessionToken,
        displayName: name,
      });
    }
  }, [playMode, onlineRoomId, onlineSessionToken]);
}
