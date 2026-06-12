import { useEffect, useRef } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../mobile/convex/_generated/api";
import type { Id } from "../../../mobile/convex/_generated/dataModel";
import { useGameStore } from "../store/gameStore";
import {
  registerOnlineMoveSubmit,
  registerOnlineReturn,
  registerUpdateDisplayName,
} from "../store/onlineBridge";
import { onlineSession } from "../store/onlineSession";

function formatOnlineMutationError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong.";

  const lower = message.toLowerCase();
  if (lower.includes("not allowed") || lower.includes("illegal")) {
    return "That move is not allowed right now.";
  }
  if (lower.includes("not your turn") || lower.includes("move player mismatch")) {
    return "It is not your turn.";
  }
  if (lower.includes("not in progress") || lower.includes("not playing")) {
    return "The game is not in progress.";
  }
  if (lower.includes("not authenticated")) {
    return "Still signing in — wait a moment and try again.";
  }
  if (lower.includes("not a member")) {
    return "You are no longer in this room.";
  }
  if (lower.includes("not enough gold") || lower.includes("wallet")) {
    return "Not enough gold.";
  }
  if (lower.includes("return")) {
    return "Return is not available right now.";
  }
  if (lower.includes("reveal")) {
    return "Reveal failed.";
  }
  return message;
}

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
  const updateDisplayName = useMutation(api.rooms.updateDisplayName);
  
  const evictedRef = useRef(false);
  const reconnectAttemptedRef = useRef(false);
  const nameReconciledKeyRef = useRef<string | null>(null);
  const ownMovePendingRef = useRef(false);
  const prevLastMoveAtRef = useRef<number | null>(null);
  const prevRoomStatusRef = useRef<"lobby" | "playing" | "finished" | null>(null);

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
    if (playMode !== "online" || !onlineRoomId || !isAuthenticated) {
      registerUpdateDisplayName(null);
      return;
    }

    registerUpdateDisplayName((displayName) => {
      void updateDisplayName({
        roomId: onlineRoomId as Id<"rooms">,
        displayName,
      }).catch((error) => {
        setOnlineStatusMessage(formatOnlineMutationError(error));
      });
    });

    return () => registerUpdateDisplayName(null);
  }, [
    playMode,
    onlineRoomId,
    isAuthenticated,
    updateDisplayName,
    setOnlineStatusMessage,
  ]);

  useEffect(() => {
    if (roomView) {
      evictedRef.current = false;

      const prevStatus = prevRoomStatusRef.current;
      const isGameStart = prevStatus === "lobby" && roomView.status === "playing";

      if (
        prevLastMoveAtRef.current != null &&
        roomView.lastMoveAt !== prevLastMoveAtRef.current &&
        !ownMovePendingRef.current &&
        !isGameStart
      ) {
        // play audio or similar
      }

      if (ownMovePendingRef.current) {
        ownMovePendingRef.current = false;
      }

      prevLastMoveAtRef.current = roomView.lastMoveAt;
      prevRoomStatusRef.current = roomView.status;
      
      // Update session storage
      const selfMember = roomView.members.find((m: any) => m.isSelf);
      if (selfMember) {
        onlineSession.touchPlaySession({
          roomId: onlineRoomId!,
          displayName: selfMember.displayName,
        });
      }

      syncOnlineState(roomView);
    }
  }, [roomView, syncOnlineState, onlineRoomId]);

  useEffect(() => {
    if (!roomView || playMode !== "online" || !onlineRoomId) return;

    const selfMember = roomView.members.find((m: any) => m.isSelf);
    if (!selfMember) return;

    const localName = useGameStore.getState().onlineDisplayName.trim() || "Player";
    if (selfMember.displayName === localName) return;

    const reconcileKey = `${onlineRoomId}:${localName}`;
    if (nameReconciledKeyRef.current === reconcileKey) return;

    nameReconciledKeyRef.current = reconcileKey;
    void updateDisplayName({
      roomId: onlineRoomId as Id<"rooms">,
      displayName: localName,
    }).catch((error) => {
      nameReconciledKeyRef.current = null;
      setOnlineStatusMessage(formatOnlineMutationError(error));
    });
  }, [roomView, playMode, onlineRoomId, updateDisplayName, setOnlineStatusMessage]);

  useEffect(() => {
    nameReconciledKeyRef.current = null;
  }, [onlineRoomId]);

  // Attempt to restore session on initialization
  useEffect(() => {
    if (!isAuthenticated || reconnectAttemptedRef.current) return;
    reconnectAttemptedRef.current = true;

    const stored = onlineSession.loadPlaySession();
    if (!stored?.online) return;
    if (onlineSession.isPlaySessionExpired(stored)) {
      onlineSession.clearPlaySession();
      return;
    }
    if (useGameStore.getState().onlineRoomId) return;
    enterOnlineLobby({
      roomId: stored.online.roomId,
      displayName: stored.online.displayName,
      code: "",
      isHost: false,
    });
  }, [isAuthenticated, enterOnlineLobby]);

  // Detect evicted or ended room
  useEffect(() => {
    if (roomView === null && playMode === "online" && onlineRoomId && !evictedRef.current) {
      evictedRef.current = true;
      setOnlineStatusMessage("Room ended or you were removed.");
      goHome();
    }
  }, [roomView, playMode, onlineRoomId, goHome, setOnlineStatusMessage]);

  // Periodic heartbeat touch
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
