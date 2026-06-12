import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState, PlayerId } from "@durak/game-core";
import type { AnchorRect } from "../components/MeasuredAnchor";
import type { FrozenDealOrigins } from "../components/DealFlightOverlay";
import {
  allCardsRevealed,
  buildDealQueue,
  dealTimingForMode,
  detectDealEvent,
  groupStepsIntoRounds,
  humanHandIdsBeforeDeal,
  initialDisplayedCounts,
  refillDisplayedCounts,
  type DealEvent,
  type DealKind,
  type QueuedDealStep,
  tableCardIdsFromPairs,
} from "../game/dealSequence";

export const DEAL_REFILL_DELAY_MS = 450;
const ORIGINS_FALLBACK_MS = 800;

function syncCountsFromGame(state: GameState): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const p of state.players) {
    out[p] = (state.hands[p] ?? []).length;
  }
  return out;
}

function humanCardIdsForDealEvent(
  state: GameState,
  humanId: PlayerId,
  event: DealEvent,
  prevState: GameState | null,
): string[] {
  const hand = state.hands[humanId] ?? [];
  const humanStepCount = event.steps.filter((s) => s.playerId === humanId).length;
  if (humanStepCount === 0) return [];

  if (event.kind === "initial") {
    return hand.slice(0, humanStepCount).map((c) => c.id);
  }

  const prevLen = prevState
    ? (prevState.hands[humanId] ?? []).length
    : hand.length - humanStepCount;

  if (
    prevState?.takeInProgress &&
    prevState.defenderId === humanId
  ) {
    const takenCount = tableCardIdsFromPairs(prevState.table).length;
    const deckDrawStart = prevLen + takenCount;
    return hand.slice(deckDrawStart, deckDrawStart + humanStepCount).map((c) => c.id);
  }

  return hand.slice(prevLen, prevLen + humanStepCount).map((c) => c.id);
}

interface PendingDeal {
  event: DealEvent;
  game: GameState;
  prev: GameState | null;
}

export interface UseDealAnimationOptions {
  game: GameState | null;
  humanId: PlayerId;
  playMode: "solo" | "online";
  reduceMotion: boolean;
  deckAnchor: AnchorRect | null;
  handAnchor: AnchorRect | null;
  seatAnchors: Record<PlayerId, AnchorRect | undefined>;
  /** Pause refill flight overlay until take animation finishes. */
  deferRefillOverlay?: boolean;
}

export interface UseDealAnimationResult {
  dealingInProgress: boolean;
  dealKind: DealKind | null;
  displayedHandCounts: Record<PlayerId, number>;
  displayedDeckCount: number;
  revealedHumanCardIds: Set<string>;
  dealQueue: QueuedDealStep[];
  frozenOrigins: FrozenDealOrigins | null;
  handleStepComplete: (step: QueuedDealStep) => void;
  handleDealComplete: () => void;
}

export function useDealAnimation({
  game,
  humanId,
  playMode,
  reduceMotion,
  deckAnchor,
  handAnchor,
  seatAnchors,
  deferRefillOverlay = false,
}: UseDealAnimationOptions): UseDealAnimationResult {
  const prevGameRef = useRef<GameState | null>(null);
  const pendingHumanCardsRef = useRef<string[]>([]);
  const humanRevealIndexRef = useRef(0);
  const refillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dealingInProgressRef = useRef(false);
  const pendingDealRef = useRef<PendingDeal | null>(null);
  const frozenOriginsRef = useRef<FrozenDealOrigins | null>(null);
  const stepIndexRef = useRef(0);
  const totalStepsRef = useRef(0);
  const playerCountRef = useRef(0);
  const dealKindRef = useRef<DealKind | null>(null);
  const pendingCountsRef = useRef<Record<PlayerId, number>>({});
  const pendingDeckRef = useRef(0);
  const pendingRefillQueueRef = useRef<QueuedDealStep[] | null>(null);

  const [dealingInProgress, setDealingInProgress] = useState(false);
  const [dealKind, setDealKind] = useState<DealKind | null>(null);
  const [displayedHandCounts, setDisplayedHandCounts] = useState<Record<PlayerId, number>>({});
  const [displayedDeckCount, setDisplayedDeckCount] = useState(0);
  const [revealedHumanCardIds, setRevealedHumanCardIds] = useState<Set<string>>(new Set());
  const [dealQueue, setDealQueue] = useState<QueuedDealStep[]>([]);
  const [frozenOrigins, setFrozenOrigins] = useState<FrozenDealOrigins | null>(null);
  const [pendingDealEpoch, setPendingDealEpoch] = useState(0);

  const timingMode = dealTimingForMode(playMode, reduceMotion);

  const originsReady = useMemo(() => {
    if (!game || !deckAnchor || !handAnchor) return false;
    for (const p of game.players) {
      if (p === humanId) continue;
      if (!seatAnchors[p]) return false;
    }
    return true;
  }, [game, deckAnchor, handAnchor, seatAnchors, humanId]);

  const snapToGame = useCallback(
    (state: GameState) => {
      if (refillTimerRef.current) {
        clearTimeout(refillTimerRef.current);
        refillTimerRef.current = null;
      }
      dealingInProgressRef.current = false;
      dealKindRef.current = null;
      pendingDealRef.current = null;
      frozenOriginsRef.current = null;
      stepIndexRef.current = 0;
      setDealingInProgress(false);
      setDealKind(null);
      setDealQueue([]);
      setFrozenOrigins(null);
      setDisplayedHandCounts(syncCountsFromGame(state));
      setDisplayedDeckCount(state.deck.length);
      setRevealedHumanCardIds(allCardsRevealed(state, humanId));
      pendingHumanCardsRef.current = [];
      humanRevealIndexRef.current = 0;
      pendingRefillQueueRef.current = null;
    },
    [humanId],
  );

  const startRefillQueue = useCallback((queue: QueuedDealStep[]) => {
    if (refillTimerRef.current) clearTimeout(refillTimerRef.current);
    refillTimerRef.current = setTimeout(() => {
      refillTimerRef.current = null;
      setDealQueue(queue);
      pendingDealRef.current = null;
      pendingRefillQueueRef.current = null;
    }, DEAL_REFILL_DELAY_MS);
  }, []);

  const flushRoundToState = useCallback((revealedBatch: string[]) => {
    setDisplayedHandCounts({ ...pendingCountsRef.current });
    setDisplayedDeckCount(pendingDeckRef.current);
    if (revealedBatch.length > 0) {
      setRevealedHumanCardIds((prev) => {
        const next = new Set(prev);
        for (const id of revealedBatch) next.add(id);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      pendingDealRef.current = null;
      dealingInProgressRef.current = false;
      dealKindRef.current = null;
      frozenOriginsRef.current = null;
      setDealingInProgress(false);
      setDealKind(null);
      setDealQueue([]);
      setFrozenOrigins(null);
      return;
    }

    const prev = prevGameRef.current;
    const event = detectDealEvent(prev, game);

    if (!event) {
      if (!dealingInProgressRef.current && !pendingDealRef.current) {
        setDisplayedHandCounts(syncCountsFromGame(game));
        setDisplayedDeckCount(game.deck.length);
        setRevealedHumanCardIds(allCardsRevealed(game, humanId));
      }
      prevGameRef.current = game;
      return;
    }

    if (dealingInProgressRef.current || pendingDealRef.current) {
      prevGameRef.current = game;
      return;
    }

    if (timingMode === "instant") {
      snapToGame(game);
      prevGameRef.current = game;
      return;
    }

    pendingHumanCardsRef.current = humanCardIdsForDealEvent(game, humanId, event, prev);
    humanRevealIndexRef.current = 0;
    stepIndexRef.current = 0;
    totalStepsRef.current = event.steps.length;
    playerCountRef.current = game.players.length;
    dealKindRef.current = event.kind;
    setDealKind(event.kind);

    const isRefill = event.kind === "refill" && prev != null;
    const baselineCounts = isRefill
      ? refillDisplayedCounts(prev)
      : initialDisplayedCounts(game);
    const baselineRevealed = isRefill
      ? humanHandIdsBeforeDeal(prev, humanId)
      : new Set<string>();

    pendingCountsRef.current = { ...baselineCounts };
    pendingDeckRef.current = isRefill
      ? prev.deck.length
      : game.deck.length + event.steps.length;

    dealingInProgressRef.current = true;
    setDealingInProgress(true);
    setDisplayedHandCounts(baselineCounts);
    setDisplayedDeckCount(pendingDeckRef.current);
    setRevealedHumanCardIds(new Set(baselineRevealed));
    setDealQueue([]);
    setFrozenOrigins(null);
    pendingDealRef.current = { event, game, prev };
    setPendingDealEpoch((e) => e + 1);

    prevGameRef.current = game;
  }, [game, humanId, timingMode, snapToGame]);

  useEffect(() => {
    const pendingDeal = pendingDealRef.current;
    if (!pendingDeal || !originsReady || !deckAnchor || !handAnchor) return;

    const snapshot: FrozenDealOrigins = {
      deck: deckAnchor,
      hand: handAnchor,
      seats: { ...seatAnchors },
    };
    frozenOriginsRef.current = snapshot;
    setFrozenOrigins(snapshot);

    const { event } = pendingDeal;
    const queue = buildDealQueue(event.steps, timingMode);

    if (event.kind === "refill") {
      pendingRefillQueueRef.current = queue;
      if (!deferRefillOverlay) {
        startRefillQueue(queue);
      }
      return () => {
        if (refillTimerRef.current) {
          clearTimeout(refillTimerRef.current);
          refillTimerRef.current = null;
        }
      };
    }

    setDealQueue(queue);
    pendingDealRef.current = null;
  }, [
    originsReady,
    timingMode,
    pendingDealEpoch,
    deckAnchor,
    handAnchor,
    seatAnchors,
    deferRefillOverlay,
    startRefillQueue,
  ]);

  useEffect(() => {
    if (deferRefillOverlay || refillTimerRef.current) return;
    const queue = pendingRefillQueueRef.current;
    if (!queue || !dealingInProgressRef.current || dealKindRef.current !== "refill") {
      return;
    }
    startRefillQueue(queue);
  }, [deferRefillOverlay, startRefillQueue]);

  useEffect(() => {
    if (!dealingInProgress || originsReady || !game) return;
    const id = setTimeout(() => {
      if (!originsReady && dealingInProgressRef.current) {
        snapToGame(game);
      }
    }, ORIGINS_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [dealingInProgress, originsReady, game, snapToGame]);

  const handleStepComplete = useCallback(
    (step: QueuedDealStep) => {
      stepIndexRef.current += 1;

      pendingCountsRef.current = {
        ...pendingCountsRef.current,
        [step.playerId]: (pendingCountsRef.current[step.playerId] ?? 0) + 1,
      };
      pendingDeckRef.current = Math.max(0, pendingDeckRef.current - 1);

      const revealedBatch: string[] = [];
      if (step.playerId === humanId) {
        const cardId = pendingHumanCardsRef.current[humanRevealIndexRef.current];
        humanRevealIndexRef.current += 1;
        if (cardId) revealedBatch.push(cardId);
      }

      const isRefill = dealKindRef.current === "refill";
      if (isRefill) {
        flushRoundToState(revealedBatch);
        return;
      }

      const roundSize = playerCountRef.current;
      const atRoundBoundary =
        roundSize > 0 && stepIndexRef.current % roundSize === 0;
      const isLastStep = stepIndexRef.current >= totalStepsRef.current;

      if (atRoundBoundary || isLastStep) {
        flushRoundToState(revealedBatch);
      } else if (revealedBatch.length > 0) {
        setRevealedHumanCardIds((prev) => {
          const next = new Set(prev);
          for (const id of revealedBatch) next.add(id);
          return next;
        });
        setDisplayedHandCounts({ ...pendingCountsRef.current });
        setDisplayedDeckCount(pendingDeckRef.current);
      }
    },
    [humanId, flushRoundToState],
  );

  const handleDealComplete = useCallback(() => {
    if (!game) return;
    snapToGame(game);
  }, [game, snapToGame]);

  const effectiveHandCounts = useMemo(() => {
    if (!game) return displayedHandCounts;
    if (!dealingInProgress) return syncCountsFromGame(game);
    return displayedHandCounts;
  }, [game, dealingInProgress, displayedHandCounts]);

  const effectiveDeckCount = useMemo(() => {
    if (!game) return 0;
    if (dealingInProgress) return displayedDeckCount;
    return game.deck.length;
  }, [game, displayedDeckCount, dealingInProgress]);

  const effectiveRevealed = useMemo(() => {
    if (!dealingInProgress) {
      return game ? allCardsRevealed(game, humanId) : new Set<string>();
    }
    return revealedHumanCardIds;
  }, [dealingInProgress, revealedHumanCardIds, game, humanId]);

  const effectiveDealKind = dealingInProgress ? dealKind : null;

  return {
    dealingInProgress,
    dealKind: effectiveDealKind,
    displayedHandCounts: effectiveHandCounts,
    displayedDeckCount: effectiveDeckCount,
    revealedHumanCardIds: effectiveRevealed,
    dealQueue,
    frozenOrigins,
    handleStepComplete,
    handleDealComplete,
  };
}

export { groupStepsIntoRounds };
