import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Card, GameState, PlayerId, Suit } from "@durak/game-core";
import type { CardFlightStep } from "../game/cardFlight";
import type { AnchorRect } from "../components/MeasuredAnchor";
import {
  buildTakeFlightQueue,
  tableCardAnchorId,
  takeTimingForMode,
  type TakeSnapshot,
} from "../game/takeSequence";
import { sortHandForDisplay } from "../game/handSort";
import { tableCardIdsFromPairs } from "../game/dealSequence";

export interface UseTakeAnimationOptions {
  game: GameState | null;
  humanId: PlayerId;
  playMode: "solo" | "online";
  reduceMotion: boolean;
  handAnchor: AnchorRect | null;
  /** Hand-card geometry for computing final sorted slot targets. */
  cardW: number;
  cardH: number;
  hPad: number;
  /** Ref updated with last-known table card anchor positions. */
  tableCardAnchorsRef: React.RefObject<Record<string, AnchorRect>>;
  /** Set before submitting a human TAKE move. */
  pendingTakeSnapshotRef: React.RefObject<TakeSnapshot | null>;
}

export interface UseTakeAnimationResult {
  takeInProgress: boolean;
  takeQueue: CardFlightStep[];
  /** Taken cards still in flight (hidden in the hand until they land). */
  hiddenCardIds: Set<string>;
  suppressTableExit: boolean;
  handleTakeStepComplete: (step: CardFlightStep) => void;
  handleTakeComplete: () => void;
}

const EMPTY_SET: Set<string> = new Set();

export function useTakeAnimation({
  game,
  humanId,
  playMode,
  reduceMotion,
  handAnchor,
  cardW,
  cardH,
  hPad,
  tableCardAnchorsRef,
  pendingTakeSnapshotRef,
}: UseTakeAnimationOptions): UseTakeAnimationResult {
  const prevGameRef = useRef<GameState | null>(null);
  const takeInProgressRef = useRef(false);

  const [takeInProgress, setTakeInProgress] = useState(false);
  const [takeQueue, setTakeQueue] = useState<CardFlightStep[]>([]);
  const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(EMPTY_SET);
  const [suppressTableExit, setSuppressTableExit] = useState(false);

  const timingMode = takeTimingForMode(playMode, reduceMotion);

  const snapToGame = useCallback(() => {
    takeInProgressRef.current = false;
    if (pendingTakeSnapshotRef.current) {
      pendingTakeSnapshotRef.current = null;
    }
    setTakeInProgress(false);
    setTakeQueue([]);
    setSuppressTableExit(false);
    setHiddenCardIds(EMPTY_SET);
  }, [pendingTakeSnapshotRef]);

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      takeInProgressRef.current = false;
      setTakeInProgress(false);
      setTakeQueue([]);
      setSuppressTableExit(false);
      setHiddenCardIds(EMPTY_SET);
      return;
    }

    const prev = prevGameRef.current;
    const prevTableIds = prev ? new Set(tableCardIdsFromPairs(prev.table)) : new Set<string>();
    const tableWasCleared =
      prev != null &&
      prev.table.length > 0 &&
      !tableCardIdsFromPairs(game.table).some((id) => prevTableIds.has(id));
    const defenderTook =
      tableWasCleared &&
      (prev!.takeInProgress || game.discard.length === prev!.discard.length);
    const humanTook = defenderTook && prev!.defenderId === humanId;

    if (
      humanTook &&
      !takeInProgressRef.current &&
      timingMode !== "instant" &&
      handAnchor
    ) {
      const snapshot: TakeSnapshot = pendingTakeSnapshotRef.current ?? (() => {
        const cardsMap: Record<string, Card> = {};
        for (const pair of prev!.table) {
          cardsMap[pair.attack.id] = pair.attack;
          if (pair.defense) {
            cardsMap[pair.defense.id] = pair.defense;
          }
        }
        return {
          cardIds: tableCardIdsFromPairs(prev!.table),
          anchors: { ...tableCardAnchorsRef.current },
          cards: cardsMap,
        };
      })();
      pendingTakeSnapshotRef.current = null;

      if (snapshot.cardIds.length > 0) {
        const preTakeIds = new Set(prev!.hands[humanId]?.map((c) => c.id) ?? []);
        // Cards new to the hand this take (the ones that fly in from the table).
        const inFlight = snapshot.cardIds.filter((id) => !preTakeIds.has(id));

        // Final sorted hand so each card flies to its real resting slot.
        const finalHand = game.hands[humanId] ?? [];
        const sortedHandIds = sortHandForDisplay(finalHand, game.trumpSuit as Suit).map(
          (c) => c.id,
        );

        const queue = buildTakeFlightQueue(snapshot, handAnchor, timingMode, {
          sortedHandIds,
          cardW,
          cardH,
          hPad,
        });
        takeInProgressRef.current = true;
        setTakeInProgress(true);
        setSuppressTableExit(true);
        setHiddenCardIds(new Set(inFlight));
        setTakeQueue(queue);
      }
    }

    if (!takeInProgressRef.current) {
      setHiddenCardIds(EMPTY_SET);
    }

    prevGameRef.current = game;
  }, [
    game,
    humanId,
    handAnchor,
    cardW,
    cardH,
    hPad,
    timingMode,
    tableCardAnchorsRef,
    pendingTakeSnapshotRef,
  ]);

  const handleTakeStepComplete = useCallback((step: CardFlightStep) => {
    // The card has landed at its slot — reveal it in the hand.
    setHiddenCardIds((prev) => {
      if (!prev.has(step.id)) return prev;
      const next = new Set(prev);
      next.delete(step.id);
      return next;
    });
  }, []);

  const handleTakeComplete = useCallback(() => {
    snapToGame();
  }, [snapToGame]);

  const effectiveHidden = useMemo(
    () => (takeInProgress ? hiddenCardIds : EMPTY_SET),
    [takeInProgress, hiddenCardIds],
  );

  return {
    takeInProgress,
    takeQueue,
    hiddenCardIds: effectiveHidden,
    suppressTableExit,
    handleTakeStepComplete,
    handleTakeComplete,
  };
}
