import {
  type GameState,
  type PlayerId,
  type TablePair,
  drawUpOrder,
  initialDealOrder,
} from "@durak/game-core";

export function tableCardIdsFromPairs(table: TablePair[]): string[] {
  const ids: string[] = [];
  for (const pair of table) {
    ids.push(pair.attack.id);
    if (pair.defense) ids.push(pair.defense.id);
  }
  return ids;
}

export type DealKind = "initial" | "refill";

export interface DealStep {
  playerId: PlayerId;
  /** Index within this player's batch (0 for first card dealt to them in this event). */
  cardIndexInBatch: number;
}

export interface DealEvent {
  kind: DealKind;
  steps: DealStep[];
}

export type DealTimingMode = "solo" | "online" | "instant";

export interface DealTiming {
  staggerMs: number;
  flightMs: number;
  useSpring: boolean;
}

export interface QueuedDealStep extends DealStep {
  delayMs: number;
  flightMs: number;
  useSpring: boolean;
}

const TIMING: Record<DealTimingMode, DealTiming> = {
  solo: { staggerMs: 0, flightMs: 220, useSpring: false },
  online: { staggerMs: 0, flightMs: 140, useSpring: false },
  instant: { staggerMs: 0, flightMs: 0, useSpring: false },
};

export function dealTimingForMode(
  playMode: "solo" | "online",
  reduceMotion: boolean,
): DealTimingMode {
  if (reduceMotion) return "instant";
  return playMode;
}

export function getDealTiming(mode: DealTimingMode): DealTiming {
  return TIMING[mode];
}

function handCounts(state: GameState): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const p of state.players) {
    out[p] = (state.hands[p] ?? []).length;
  }
  return out;
}

function buildRefillSteps(prev: GameState, next: GameState): DealStep[] {
  const prevCounts = handCounts(prev);
  const steps: DealStep[] = [];
  const takenCount = prev.takeInProgress
    ? tableCardIdsFromPairs(prev.table).length
    : 0;

  for (const playerId of drawUpOrder(next)) {
    let gained = (next.hands[playerId] ?? []).length - (prevCounts[playerId] ?? 0);
    if (prev.takeInProgress && playerId === prev.defenderId) {
      gained = Math.max(0, gained - takenCount);
    }
    for (let i = 0; i < gained; i++) {
      steps.push({ playerId, cardIndexInBatch: i });
    }
  }
  return steps;
}

function isLikelyFreshGameStart(next: GameState): boolean {
  const sizes = next.players.map((p) => (next.hands[p] ?? []).length);
  if (sizes.length === 0 || !sizes.every((s) => s === sizes[0])) return false;
  const handSize = sizes[0]!;
  return (
    handSize >= 6 &&
    next.table.length === 0 &&
    next.discard.length === 0 &&
    next.finishedOrder.length === 0
  );
}

/**
 * Detects when the UI should run a deal animation sequence.
 * Returns null when no deal event occurred.
 */
export function detectDealEvent(prev: GameState | null, next: GameState): DealEvent | null {
  if (next.phase !== "playing") return null;

  const nextCounts = handCounts(next);
  const totalNext = Object.values(nextCounts).reduce((a, b) => a + b, 0);
  if (totalNext === 0) return null;

  if (!prev) {
    if (!isLikelyFreshGameStart(next)) return null;
    return {
      kind: "initial",
      steps: initialDealOrder(next.players).map((playerId, i) => ({
        playerId,
        cardIndexInBatch: Math.floor(i / next.players.length),
      })),
    };
  }

  if (prev.phase !== "playing") return null;

  const prevCounts = handCounts(prev);
  const prevTotal = Object.values(prevCounts).reduce((a, b) => a + b, 0);

  if (prevTotal === 0 && totalNext > 0) {
    return {
      kind: "initial",
      steps: initialDealOrder(next.players).map((playerId, i) => ({
        playerId,
        cardIndexInBatch: Math.floor(i / next.players.length),
      })),
    };
  }

  const deckDropped = next.deck.length < prev.deck.length;
  const anyHandGrew = next.players.some(
    (p) => (next.hands[p] ?? []).length > (prev.hands[p] ?? []).length,
  );

  if (deckDropped && anyHandGrew) {
    const steps = buildRefillSteps(prev, next);
    if (steps.length > 0) {
      return { kind: "refill", steps };
    }
  }

  return null;
}

export function buildDealQueue(
  steps: DealStep[],
  mode: DealTimingMode,
): QueuedDealStep[] {
  const timing = getDealTiming(mode);
  return steps.map((step, index) => ({
    ...step,
    delayMs: index * timing.staggerMs,
    flightMs: timing.flightMs,
    useSpring: timing.useSpring,
  }));
}

export function dealSequenceDurationMs(queue: QueuedDealStep[]): number {
  if (queue.length === 0) return 0;
  return queue.reduce((total, step) => total + step.flightMs + 60, 0);
}

/** Group consecutive steps into deal rounds (one card per player per round). */
export function groupStepsIntoRounds(
  steps: DealStep[],
  playerCount: number,
): DealStep[][] {
  if (playerCount <= 0 || steps.length === 0) return [];
  const rounds: DealStep[][] = [];
  for (let i = 0; i < steps.length; i += playerCount) {
    rounds.push(steps.slice(i, i + playerCount));
  }
  return rounds;
}

export function initialDisplayedCounts(state: GameState): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const p of state.players) {
    out[p] = 0;
  }
  return out;
}

/** Hand counts before a mid-game draw-up (from pre-refill game state). */
export function refillDisplayedCounts(prev: GameState): Record<PlayerId, number> {
  return handCounts(prev);
}

/** Card IDs already in the human hand before a mid-game draw-up. */
export function humanHandIdsBeforeDeal(prev: GameState, humanId: PlayerId): Set<string> {
  return new Set((prev.hands[humanId] ?? []).map((c) => c.id));
}

export function allCardsRevealed(state: GameState, humanId: PlayerId): Set<string> {
  return new Set((state.hands[humanId] ?? []).map((c) => c.id));
}
