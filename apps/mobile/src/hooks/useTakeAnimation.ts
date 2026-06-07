import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState, PlayerId } from "@durak/game-core";
import type { CardFlightStep } from "../game/cardFlight";
import type { AnchorRect } from "../components/MeasuredAnchor";
import {
  buildTakeFlightQueue,
  tableCardIdsFromPairs,
  tableCardAnchorId,
  takeTimingForMode,
  type TakeSnapshot,
} from "../game/takeSequence";

export interface UseTakeAnimationOptions {
  game: GameState | null;
  humanId: PlayerId;
  playMode: "solo" | "online";
  reduceMotion: boolean;
  handAnchor: AnchorRect | null;
  /** Ref updated with last-known table card anchor positions. */
  tableCardAnchorsRef: React.RefObject<Record<string, AnchorRect>>;
  /** Set before submitting a human TAKE move. */
  pendingTakeSnapshotRef: React.RefObject<TakeSnapshot | null>;
}

export interface UseTakeAnimationResult {
  takeInProgress: boolean;
  takeQueue: CardFlightStep[];
  revealedTakenCardIds: Set<string>;
  suppressTableExit: boolean;
  handleTakeStepComplete: (step: CardFlightStep) => void;
  handleTakeComplete: () => void;
}

export function useTakeAnimation({
  game,
  humanId,
  playMode,
  reduceMotion,
  handAnchor,
  tableCardAnchorsRef,
  pendingTakeSnapshotRef,
}: UseTakeAnimationOptions): UseTakeAnimationResult {
  const prevGameRef = useRef<GameState | null>(null);
  const takeInProgressRef = useRef(false);
  const preTakeHandIdsRef = useRef<Set<string>>(new Set());
  const pendingTakenIdsRef = useRef<string[]>([]);
  const revealIndexRef = useRef(0);

  const [takeInProgress, setTakeInProgress] = useState(false);
  const [takeQueue, setTakeQueue] = useState<CardFlightStep[]>([]);
  const [revealedTakenCardIds, setRevealedTakenCardIds] = useState<Set<string>>(new Set());
  const [suppressTableExit, setSuppressTableExit] = useState(false);

  const timingMode = takeTimingForMode(playMode, reduceMotion);

  const snapToGame = useCallback(
    (state: GameState) => {
      takeInProgressRef.current = false;
      pendingTakenIdsRef.current = [];
      revealIndexRef.current = 0;
      if (pendingTakeSnapshotRef.current) {
        pendingTakeSnapshotRef.current = null;
      }
      setTakeInProgress(false);
      setTakeQueue([]);
      setSuppressTableExit(false);
      setRevealedTakenCardIds(new Set(state.hands[humanId]?.map((c) => c.id) ?? []));
    },
    [humanId, pendingTakeSnapshotRef],
  );

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      takeInProgressRef.current = false;
      setTakeInProgress(false);
      setTakeQueue([]);
      setSuppressTableExit(false);
      return;
    }

    const prev = prevGameRef.current;
    const tableCleared = prev != null && prev.table.length > 0 && game.table.length === 0;
    const humanTook =
      tableCleared &&
      prev!.takeInProgress &&
      prev!.defenderId === humanId;

    if (
      humanTook &&
      !takeInProgressRef.current &&
      timingMode !== "instant" &&
      handAnchor
    ) {
      const snapshot = pendingTakeSnapshotRef.current ?? {
        cardIds: tableCardIdsFromPairs(prev!.table),
        anchors: { ...tableCardAnchorsRef.current },
      };
      pendingTakeSnapshotRef.current = null;

      if (snapshot.cardIds.length > 0) {
        const preTakeIds = new Set(prev!.hands[humanId]?.map((c) => c.id) ?? []);
        preTakeHandIdsRef.current = preTakeIds;
        pendingTakenIdsRef.current = snapshot.cardIds.filter((id) => !preTakeIds.has(id));
        revealIndexRef.current = 0;

        const queue = buildTakeFlightQueue(snapshot, handAnchor, timingMode);
        takeInProgressRef.current = true;
        setTakeInProgress(true);
        setSuppressTableExit(true);
        setRevealedTakenCardIds(new Set(preTakeIds));
        setTakeQueue(queue);
      }
    }

    if (!takeInProgressRef.current) {
      setRevealedTakenCardIds(new Set(game.hands[humanId]?.map((c) => c.id) ?? []));
    }

    prevGameRef.current = game;
  }, [
    game,
    humanId,
    handAnchor,
    timingMode,
    tableCardAnchorsRef,
    pendingTakeSnapshotRef,
  ]);

  const handleTakeStepComplete = useCallback(
    (_step: CardFlightStep) => {
      const cardId = pendingTakenIdsRef.current[revealIndexRef.current];
      revealIndexRef.current += 1;
      if (cardId) {
        setRevealedTakenCardIds((prev) => {
          const next = new Set(prev);
          next.add(cardId);
          return next;
        });
      }
    },
    [],
  );

  const handleTakeComplete = useCallback(() => {
    if (!game) return;
    snapToGame(game);
  }, [game, snapToGame]);

  const effectiveRevealed = useMemo(() => {
    if (!takeInProgress) {
      return game ? new Set(game.hands[humanId]?.map((c) => c.id) ?? []) : new Set<string>();
    }
    return revealedTakenCardIds;
  }, [takeInProgress, revealedTakenCardIds, game, humanId]);

  return {
    takeInProgress,
    takeQueue,
    revealedTakenCardIds: effectiveRevealed,
    suppressTableExit,
    handleTakeStepComplete,
    handleTakeComplete,
  };
}
