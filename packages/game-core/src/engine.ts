import { buildDeck, mulberry32, shuffle } from "./deck";
import {
  attackers,
  beats,
  canPass,
  canTake,
  handOf,
  isTrump,
  legalAttacks,
  legalDefenses,
  legalTransfers,
  seatAfter,
  undefendedCount,
} from "./rules";
import {
  DEFAULT_RULES,
  type Card,
  type GameRules,
  type GameState,
  type Move,
  type PlayerId,
} from "./types";

const HAND_SIZE = 6;
const FIRST_BOUT_MAX_ATTACKS = 5;
const MAX_ATTACKS = 6;

/** Round-robin deal order at game start (one card per player per round). */
export function initialDealOrder(playerIds: PlayerId[], handSize = HAND_SIZE): PlayerId[] {
  const order: PlayerId[] = [];
  for (let i = 0; i < handSize; i++) {
    for (const p of playerIds) {
      order.push(p);
    }
  }
  return order;
}

/** Refill order after a bout: attacker, remaining attackers in seat order, defender last. */
export function drawUpOrder(state: GameState): PlayerId[] {
  const order: PlayerId[] = [state.attackerId];
  let cursor = state.attackerId;
  for (let k = 0; k < state.players.length; k++) {
    cursor = seatAfter(state, cursor, false);
    if (cursor === state.attackerId) break;
    if (cursor !== state.defenderId) order.push(cursor);
  }
  order.push(state.defenderId);
  return order;
}

export interface CreateGameOptions {
  /** Seed for the shuffle so games are reproducible. */
  seed?: number;
  /** House rules; unspecified fields use defaults (podkidnoy + all throw-in). */
  rules?: Partial<GameRules>;
}

function cloneState(s: GameState): GameState {
  const hands: Record<PlayerId, Card[]> = {};
  for (const p of s.players) hands[p] = (s.hands[p] ?? []).slice();
  return {
    players: s.players,
    hands,
    deck: s.deck.slice(),
    trumpSuit: s.trumpSuit,
    trumpCard: s.trumpCard,
    table: s.table.map((pair) => ({ ...pair })),
    discard: s.discard.slice(),
    attackerId: s.attackerId,
    defenderId: s.defenderId,
    takeInProgress: s.takeInProgress,
    passed: s.passed.slice(),
    finishedOrder: s.finishedOrder.slice(),
    loserId: s.loserId,
    phase: s.phase,
    maxAttacks: s.maxAttacks,
    rules: s.rules,
  };
}

/** Deep copy of game state (for client-side undo snapshots). */
export function cloneGameState(s: GameState): GameState {
  return cloneState(s);
}

/** First attacker = holder of the lowest trump; falls back to the first seat. */
function findFirstAttacker(state: GameState): PlayerId {
  let bestPlayer: PlayerId | null = null;
  let bestRank = Infinity;
  for (const p of state.players) {
    for (const card of handOf(state, p)) {
      if (isTrump(card, state.trumpSuit) && card.rank < bestRank) {
        bestRank = card.rank;
        bestPlayer = p;
      }
    }
  }
  return bestPlayer ?? state.players[0]!;
}

export function createGame(
  playerIds: PlayerId[],
  options: CreateGameOptions = {},
): GameState {
  if (playerIds.length < 2 || playerIds.length > 6) {
    throw new Error("Durak supports 2 to 6 players.");
  }
  const seed = options.seed ?? (Math.random() * 2 ** 32) >>> 0;
  const deck = shuffle(buildDeck(), mulberry32(seed));

  const rules: GameRules = {
    variant: options.rules?.variant ?? DEFAULT_RULES.variant,
    throwInScope: options.rules?.throwInScope ?? DEFAULT_RULES.throwInScope,
    playStyle: options.rules?.playStyle ?? DEFAULT_RULES.playStyle,
  };

  // Bottom card fixes the trump suit and is drawn last.
  const trumpCard = deck[deck.length - 1]!;
  const trumpSuit = trumpCard.suit;

  const hands: Record<PlayerId, Card[]> = {};
  for (const p of playerIds) hands[p] = [];
  for (const p of initialDealOrder(playerIds)) {
    const card = deck.shift();
    if (card) hands[p]!.push(card);
  }

  const base: GameState = {
    players: playerIds.slice(),
    hands,
    deck,
    trumpSuit,
    trumpCard,
    table: [],
    discard: [],
    attackerId: playerIds[0]!,
    defenderId: playerIds[1]!,
    takeInProgress: false,
    passed: [],
    finishedOrder: [],
    loserId: null,
    phase: "playing",
    maxAttacks: FIRST_BOUT_MAX_ATTACKS,
    rules,
  };

  base.attackerId = findFirstAttacker(base);
  base.defenderId = seatAfter(base, base.attackerId, false);
  return base;
}

function hasCard(hand: Card[], card: Card): boolean {
  return hand.some((c) => c.id === card.id);
}

function removeCard(hand: Card[], card: Card): Card[] {
  const i = hand.findIndex((c) => c.id === card.id);
  if (i === -1) return hand;
  const copy = hand.slice();
  copy.splice(i, 1);
  return copy;
}

/**
 * Applies a move and returns the resulting state. Throws on an illegal move so
 * the same code can act as the authority on a server.
 */
export function applyMove(prev: GameState, move: Move): GameState {
  if (prev.phase !== "playing") {
    throw new Error("The game is over.");
  }
  const state = cloneState(prev);

  switch (move.type) {
    case "ATTACK": {
      const legal = legalAttacks(prev, move.player);
      if (!legal.some((c) => c.id === move.card.id)) {
        throw new Error("Illegal attack.");
      }
      state.hands[move.player] = removeCard(handOf(state, move.player), move.card);
      state.table.push({ attack: move.card });
      // A fresh card on the table reopens the round for everyone.
      state.passed = [];
      break;
    }

    case "DEFEND": {
      if (move.player !== prev.defenderId || prev.takeInProgress) {
        throw new Error("Only the defender may defend.");
      }
      const pair = prev.table[move.target];
      if (!pair || pair.defense) {
        throw new Error("Nothing to defend at that position.");
      }
      if (
        !hasCard(handOf(prev, move.player), move.card) ||
        !beats(move.card, pair.attack, prev.trumpSuit)
      ) {
        throw new Error("That card cannot beat the attack.");
      }
      state.hands[move.player] = removeCard(handOf(state, move.player), move.card);
      state.table[move.target]!.defense = move.card;
      resolveIfReady(state);
      break;
    }

    case "TRANSFER": {
      if (move.player !== prev.defenderId || prev.takeInProgress) {
        throw new Error("Only the defender may transfer.");
      }
      const legal = legalTransfers(prev, move.target);
      if (!legal.some((c) => c.id === move.card.id)) {
        throw new Error("Illegal transfer.");
      }
      const oldDefender = prev.defenderId;
      state.hands[move.player] = removeCard(handOf(state, move.player), move.card);
      state.table.push({ attack: move.card, viaTransfer: true });
      state.defenderId = seatAfter(state, oldDefender, true);
      state.passed = [];
      break;
    }

    case "TAKE": {
      if (!canTake(prev, move.player)) {
        throw new Error("Cannot take right now.");
      }
      state.takeInProgress = true;
      state.passed = [];
      resolveIfReady(state);
      break;
    }

    case "PASS": {
      if (!canPass(prev, move.player)) {
        throw new Error("Cannot pass right now.");
      }
      if (!state.passed.includes(move.player)) state.passed.push(move.player);
      resolveIfReady(state);
      break;
    }

    default: {
      const _exhaustive: never = move;
      throw new Error(`Unknown move: ${JSON.stringify(_exhaustive)}`);
    }
  }

  markFinishedPlayers(state);
  if (checkGameOver(state)) return state;
  tryResolveZeroAttackers(state);
  markFinishedPlayers(state);
  checkGameOver(state);
  return state;
}

function markFinishedPlayers(state: GameState): void {
  for (const p of state.players) {
    if (
      handOf(state, p).length === 0 &&
      state.deck.length === 0 &&
      !state.finishedOrder.includes(p)
    ) {
      state.finishedOrder.push(p);
    }
  }
}

/** Resolves leftover table cards when the game ends mid-bout. */
function settleTableForGameEnd(state: GameState, soleHolder: PlayerId | null): void {
  for (const pair of state.table) {
    if (soleHolder && !pair.defense) {
      state.hands[soleHolder] = [...handOf(state, soleHolder), pair.attack];
    } else {
      state.discard.push(pair.attack);
      if (pair.defense) state.discard.push(pair.defense);
    }
  }
}

/** Returns true when the game has just ended (deck empty, at most one holder). */
function checkGameOver(state: GameState): boolean {
  if (state.deck.length > 0) return false;

  const inPlay = state.players.filter((p) => handOf(state, p).length > 0);
  if (inPlay.length > 1) return false;

  if (inPlay.length === 1) {
    const sole = inPlay[0]!;
    const othersAllFinished = state.players
      .filter((p) => p !== sole)
      .every((p) => state.finishedOrder.includes(p));
    if (!othersAllFinished) return false;

    // Two-player end duel: let the defender answer the last attack.
    if (
      state.players.length === 2 &&
      (state.table.length > 0 || state.takeInProgress)
    ) {
      const defender = state.defenderId;
      if (
        handOf(state, defender).length > 0 &&
        !state.finishedOrder.includes(defender)
      ) {
        return false;
      }
    }
  }

  settleTableForGameEnd(state, inPlay[0] ?? null);

  state.phase = "gameOver";
  state.loserId = inPlay.length === 1 ? inPlay[0]! : null;
  state.table = [];
  state.passed = [];
  state.takeInProgress = false;
  return true;
}

function assignNextRoles(state: GameState, defenderTook: boolean): void {
  let newAttacker = defenderTook
    ? seatAfter(state, state.defenderId, true)
    : handOf(state, state.defenderId).length > 0
      ? state.defenderId
      : seatAfter(state, state.defenderId, true);

  if (handOf(state, newAttacker).length === 0) {
    newAttacker = seatAfter(state, newAttacker, true);
  }

  let newDefender = seatAfter(state, newAttacker, true);
  if (handOf(state, newDefender).length === 0) {
    newDefender = seatAfter(state, newDefender, true);
  }

  state.attackerId = newAttacker;
  state.defenderId = newDefender;
}

/** When every attacker is out, finish or advance the bout without hanging. */
function tryResolveZeroAttackers(state: GameState): void {
  if (state.phase !== "playing") return;
  const atk = attackers(state);
  if (atk.length > 0 || state.takeInProgress) return;

  if (state.table.length > 0 && undefendedCount(state) === 0) {
    for (const pair of state.table) {
      state.discard.push(pair.attack);
      if (pair.defense) state.discard.push(pair.defense);
    }
    endRound(state, false);
    return;
  }

  if (state.table.length === 0) {
    endRound(state, false);
  }
}

/** Ends the round once every attacker has passed (or the defender has taken). */
function resolveIfReady(state: GameState): void {
  tryResolveZeroAttackers(state);
  if (state.phase !== "playing") return;

  const atk = attackers(state);
  const allPassed = atk.every((p) => state.passed.includes(p));
  if (!allPassed) return;

  if (state.takeInProgress) {
    const taken: Card[] = [];
    for (const pair of state.table) {
      taken.push(pair.attack);
      if (pair.defense) taken.push(pair.defense);
    }
    state.hands[state.defenderId] = [...handOf(state, state.defenderId), ...taken];
    endRound(state, true);
    return;
  }

  if (state.table.length > 0 && undefendedCount(state) === 0) {
    for (const pair of state.table) {
      state.discard.push(pair.attack);
      if (pair.defense) state.discard.push(pair.defense);
    }
    endRound(state, false);
  }
}

function drawUp(state: GameState): void {
  for (const p of drawUpOrder(state)) {
    const hand = state.hands[p] ?? [];
    while (hand.length < HAND_SIZE && state.deck.length > 0) {
      const card = state.deck.shift();
      if (card) hand.push(card);
    }
    state.hands[p] = hand;
  }
}

function endRound(state: GameState, defenderTook: boolean): void {
  drawUp(state);
  markFinishedPlayers(state);

  state.table = [];
  state.passed = [];
  state.takeInProgress = false;

  if (state.maxAttacks < MAX_ATTACKS) {
    state.maxAttacks = MAX_ATTACKS;
  }

  if (checkGameOver(state)) return;
  assignNextRoles(state, defenderTook);
}

export function isGameOver(state: GameState): boolean {
  return state.phase === "gameOver";
}

export function getLoser(state: GameState): PlayerId | null {
  return state.loserId;
}

/** End the match immediately because a player forfeited; forfeiter is the durak. */
export function forceForfeitEnd(state: GameState, forfeiterId: PlayerId): GameState {
  if (state.phase === "gameOver") {
    throw new Error("Game already over");
  }
  if (!state.players.includes(forfeiterId)) {
    throw new Error("Player not in game");
  }

  const next = cloneGameState(state);
  const alreadyFinished = new Set(next.finishedOrder);
  const finishedOrder = [...next.finishedOrder];

  for (const p of next.players) {
    if (p === forfeiterId || alreadyFinished.has(p)) continue;
    finishedOrder.push(p);
  }

  next.finishedOrder = finishedOrder;
  next.phase = "gameOver";
  next.loserId = forfeiterId;
  next.table = [];
  next.passed = [];
  next.takeInProgress = false;
  return next;
}

export {
  legalAttacks,
  legalDefenses,
  legalTransfers,
  canTransfer,
  canTake,
  canPass,
  beats,
  isTrump,
  canThrowIn,
  isNeighborOfDefender,
} from "./rules";
