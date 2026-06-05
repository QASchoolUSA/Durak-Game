import { useEffect, useRef } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { trigger } from "../feedback/haptics";
import { playSound } from "../feedback/sounds";
import { formatOnlineMutationError } from "./onlineMutationErrors";
import { registerOnlineMoveSubmit, registerOnlineReturn } from "./onlineBridge";
import { loadRoomSession, saveRoomSession } from "./onlineSessionStorage";
import { useGameStore } from "./store";

const GAME_START_FEEDBACK_GRACE_MS = 1500;

export function useOnlineGame() {
  const { isAuthenticated } = useConvexAuth();
  const playMode = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);
  const syncOnlineState = useGameStore((s) => s.syncOnlineState);
  const goHome = useGameStore((s) => s.goHome);
  const setOnlineStatusMessage = useGameStore((s) => s.setOnlineStatusMessage);
  const setSubmittingMove = useGameStore((s) => s.setSubmittingMove);

  const submitMove = useMutation(api.rooms.submitMove);
  const useReturnAbility = useMutation(api.rooms.useReturnAbility);
  const touchRoom = useMutation(api.rooms.touchRoom);
  const evictedRef = useRef(false);
  const reconnectAttemptedRef = useRef(false);
  const ownMovePendingRef = useRef(false);
  const prevLastMoveAtRef = useRef<number | null>(null);
  const prevRoomStatusRef = useRef<"lobby" | "playing" | "finished" | null>(null);
  const gameStartAtRef = useRef<number | null>(null);

  const roomView = useQuery(
    api.rooms.getRoomView,
    playMode === "online" && onlineRoomId && isAuthenticated
      ? { roomId: onlineRoomId as Id<"rooms"> }
      : "skip",
  );

  useEffect(() => {
    if (playMode !== "online" || !onlineRoomId || !isAuthenticated) return;

    registerOnlineMoveSubmit((move) => {
      if (!onlineRoomId) return;
      ownMovePendingRef.current = true;
      setSubmittingMove(true);
      void submitMove({
        roomId: onlineRoomId as Id<"rooms">,
        move,
      }).catch((error) => {
        ownMovePendingRef.current = false;
        setSubmittingMove(false);
        trigger("error");
        setOnlineStatusMessage(formatOnlineMutationError(error));
      });
    });

    return () => registerOnlineMoveSubmit(null);
  }, [
    playMode,
    onlineRoomId,
    isAuthenticated,
    submitMove,
    setOnlineStatusMessage,
    setSubmittingMove,
  ]);

  useEffect(() => {
    if (playMode !== "online" || !onlineRoomId || !isAuthenticated) {
      registerOnlineReturn(null);
      return;
    }

    registerOnlineReturn(() => {
      ownMovePendingRef.current = true;
      setSubmittingMove(true);
      void useReturnAbility({
        roomId: onlineRoomId as Id<"rooms">,
      }).catch((error) => {
        ownMovePendingRef.current = false;
        setSubmittingMove(false);
        trigger("error");
        setOnlineStatusMessage(formatOnlineMutationError(error));
      });
    });

    return () => registerOnlineReturn(null);
  }, [
    playMode,
    onlineRoomId,
    isAuthenticated,
    useReturnAbility,
    setOnlineStatusMessage,
    setSubmittingMove,
  ]);

  useEffect(() => {
    if (roomView) {
      evictedRef.current = false;

      const prevStatus = prevRoomStatusRef.current;
      const isGameStart = prevStatus === "lobby" && roomView.status === "playing";
      if (isGameStart) {
        gameStartAtRef.current = Date.now();
      }

      const inStartGrace =
        gameStartAtRef.current != null &&
        Date.now() - gameStartAtRef.current < GAME_START_FEEDBACK_GRACE_MS;

      if (
        prevLastMoveAtRef.current != null &&
        roomView.lastMoveAt !== prevLastMoveAtRef.current &&
        !ownMovePendingRef.current &&
        !isGameStart &&
        !inStartGrace
      ) {
        trigger("cardPlay");
        playSound("cardPlay");
      }

      if (ownMovePendingRef.current) {
        ownMovePendingRef.current = false;
      }

      prevLastMoveAtRef.current = roomView.lastMoveAt;
      prevRoomStatusRef.current = roomView.status;
      syncOnlineState(roomView);
    }
  }, [roomView, syncOnlineState]);

  useEffect(() => {
    if (!isAuthenticated || reconnectAttemptedRef.current) return;
    reconnectAttemptedRef.current = true;

    void (async () => {
      const stored = await loadRoomSession();
      if (!stored) return;
      if (useGameStore.getState().onlineRoomId) return;
      enterOnlineLobby({
        roomId: stored.roomId,
        displayName: stored.displayName,
        code: "",
        isHost: false,
      });
    })();
  }, [isAuthenticated, enterOnlineLobby]);

  useEffect(() => {
    if (roomView === null && playMode === "online" && onlineRoomId && !evictedRef.current) {
      evictedRef.current = true;
      setOnlineStatusMessage("Room ended or you were removed.");
      goHome();
    }
  }, [roomView, playMode, onlineRoomId, goHome, setOnlineStatusMessage]);

  useEffect(() => {
    if (playMode === "online" && onlineRoomId) {
      const name = useGameStore.getState().onlineDisplayName;
      void saveRoomSession({
        roomId: onlineRoomId,
        displayName: name,
      });
    }
  }, [playMode, onlineRoomId]);

  useEffect(() => {
    if (playMode !== "online" || !onlineRoomId || !isAuthenticated) return;

    const tick = () => {
      void touchRoom({
        roomId: onlineRoomId as Id<"rooms">,
      });
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [playMode, onlineRoomId, isAuthenticated, touchRoom]);
}
