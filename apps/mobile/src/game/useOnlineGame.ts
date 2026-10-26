import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { trigger } from "../feedback/haptics";
import { playSound } from "../feedback/sounds";
import { formatOnlineMutationError } from "./onlineMutationErrors";
import {
  registerOnlineMoveSubmit,
  registerOnlineReturn,
  registerUpdateDisplayName,
} from "./onlineBridge";
import {
  clearPlaySession,
  isPlaySessionExpired,
  loadPlaySession,
} from "./onlineSessionStorage";
import { useGameStore } from "./store";
import type { Move } from "@durak/game-core";

const GAME_START_FEEDBACK_GRACE_MS = 1500;

function newClientMoveId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
  const markOnlineMutationSettled = useGameStore((s) => s.markOnlineMutationSettled);

  const submitMove = useMutation(api.rooms.submitMove);
  const useReturnAbility = useMutation(api.rooms.useReturnAbility);
  const touchRoom = useMutation(api.rooms.touchRoom);
  const updateDisplayName = useMutation(api.rooms.updateDisplayName);
  const evictedRef = useRef(false);
  const reconnectAttemptedRef = useRef(false);
  const nameReconciledKeyRef = useRef<string | null>(null);
  const ownMovePendingRef = useRef(false);
  const pendingClientMoveIdRef = useRef<string | null>(null);
  const lastRoomViewRef = useRef<import("./onlineTypes").RoomView | null>(null);
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

    registerOnlineMoveSubmit((move: Move) => {
      if (!onlineRoomId) return;
      const clientMoveId = newClientMoveId();
      ownMovePendingRef.current = true;
      pendingClientMoveIdRef.current = clientMoveId;
      setSubmittingMove(true);
      void submitMove({
        roomId: onlineRoomId as Id<"rooms">,
        move,
        clientMoveId,
      })
        .then(() => {
          if (pendingClientMoveIdRef.current !== clientMoveId) return;
          markOnlineMutationSettled();
          // Reconcile immediately if a newer view already arrived while HTTP was open.
          const latest = lastRoomViewRef.current;
          if (latest) syncOnlineState(latest);
        })
        .catch((error) => {
          if (pendingClientMoveIdRef.current !== clientMoveId) return;
          ownMovePendingRef.current = false;
          pendingClientMoveIdRef.current = null;
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
    markOnlineMutationSettled,
    syncOnlineState,
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
      lastRoomViewRef.current = roomView;
      evictedRef.current = false;

      const prevStatus = prevRoomStatusRef.current;
      const isGameStart = prevStatus === "lobby" && roomView.status === "playing";
      if (isGameStart) {
        gameStartAtRef.current = Date.now();
      }

      const inStartGrace =
        gameStartAtRef.current != null &&
        Date.now() - gameStartAtRef.current < GAME_START_FEEDBACK_GRACE_MS;

      const st = useGameStore.getState();
      const base = st.pendingSubmitBaseVersion;
      const versionAdvanced =
        base == null || (roomView.version ?? 0) > base;
      const submitFullyAcked =
        st.pendingMutationSettled && versionAdvanced;

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

      // Only clear own-move pending once HTTP settled and version advanced.
      if (ownMovePendingRef.current && submitFullyAcked) {
        ownMovePendingRef.current = false;
        pendingClientMoveIdRef.current = null;
      }

      prevLastMoveAtRef.current = roomView.lastMoveAt;
      prevRoomStatusRef.current = roomView.status;
      syncOnlineState(roomView);
    }
  }, [roomView, syncOnlineState]);

  useEffect(() => {
    if (!roomView || playMode !== "online" || !onlineRoomId) return;

    const selfMember = roomView.members.find((m) => m.isSelf);
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

  useEffect(() => {
    if (!isAuthenticated || reconnectAttemptedRef.current) return;
    reconnectAttemptedRef.current = true;

    void (async () => {
      const stored = await loadPlaySession();
      if (!stored?.online) return;
      if (isPlaySessionExpired(stored)) {
        await clearPlaySession();
        return;
      }
      if (useGameStore.getState().onlineRoomId) return;
      enterOnlineLobby({
        roomId: stored.online.roomId,
        displayName: stored.online.displayName,
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

  // Foreground: recover presence. Background/hide: stamp away for reconnect UI.
  useEffect(() => {
    if (playMode !== "online" || !onlineRoomId || !isAuthenticated) return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void touchRoom({
          roomId: onlineRoomId as Id<"rooms">,
          active: true,
        });
        return;
      }
      void touchRoom({
        roomId: onlineRoomId as Id<"rooms">,
        active: false,
      });
    });
    return () => sub.remove();
  }, [playMode, onlineRoomId, isAuthenticated, touchRoom]);
}
