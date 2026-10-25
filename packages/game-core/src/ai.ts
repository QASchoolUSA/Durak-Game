import { applyMove } from "./engine";
import {
  attackers,
  canPass,
  canTake,
  handOf,
  isTrump,
  legalAttacks,
  legalDefenses,
  legalTransfers,
  seatAfter,
  undefendedCount,
  undefendedPairs,
} from "./rules";
import type { Card, GameState, Move, PlayerId } from "./types";

export type AiDifficulty = "easy" | "medium" | "hard";

const MAX_CANDIDATES: Record<AiDifficulty, number> = {
  easy: 4,
  medium: 6,
  hard: 8,
};

/** Search depth after the candidate move is applied. */
const SEARCH_DEPTH: Record<AiDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

/** Trumps are worth holding on to, so they sort as more valuable. */
function value(card: Card, trumpSuit: GameState["trumpSuit"]): number {
  return card.rank + (isTrump(card, trumpSuit) ? 100 : 0);
}

function rankCountInHand(hand: Card[], rank: number): number {
  return hand.filter((c) => c.rank === rank).length;
}

function pileSize(state: GameState): number {
  return state.table.reduce((n, p) => n + 1 + (p.defense ? 1 : 0), 0);
}

/**
 * Position score from `me`'s perspective. Higher is better.
 * Captures hand quality, endgame pressure, bout outcomes, and trump inventory.
 */
export function evaluatePosition(state: GameState, me: PlayerId): number {
  if (state.phase === "gameOver") {
    if (state.loserId === me) return -100_000;
    const finishIdx = state.finishedOrder.indexOf(me);
    if (finishIdx >= 0) {
      return 50_000 - finishIdx * 1_000;
    }
    return 0;
  }

  const trumpSuit = state.trumpSuit;
  const hand = handOf(state, me);
  let score = 0;

  // Prefer fewer cards; amplify when the deck is thin or empty.
  const deckLen = state.deck.length;
  const handSizeWeight = deckLen === 0 ? 180 : deckLen <= 6 ? 80 : 45;
  score -= hand.length * handSizeWeight;

  for (const c of hand) {
    if (isTrump(c, trumpSuit)) {
      // Trump inventory is an asset (especially mid/high).
      score += 25 + c.rank * 2;
    } else if (c.rank <= 8) {
      // Low non-trumps are useful attack ammo — mild asset to hold.
      score += 6;
    } else {
      // High non-trumps are mild liabilities (harder to dump, burn on defense).
      score -= (c.rank - 8) * 2;
    }
  }

  // Opponents holding many cards is good for us.
  for (const p of state.players) {
    if (p === me) continue;
    const oppLen = handOf(state, p).length;
    score += oppLen * (deckLen === 0 ? 90 : 28);
    if (deckLen === 0) {
      if (oppLen === 0) score -= 40;
      else if (oppLen === 1) score -= 25;
    }
  }

  // Under fire as defender: each uncovered attack is pressure.
  if (me === state.defenderId && state.table.length > 0) {
    score -= undefendedCount(state) * 35;
    if (state.takeInProgress) {
      score -= pileSize(state) * 55;
    }
  }

  // Pending take: treat the pile as cards the defender is about to receive.
  if (state.takeInProgress && me !== state.defenderId) {
    score += pileSize(state) * 50;
  }

  return score;
}

/** Immediate preference for opening leads (lower is better). */
function openingHeuristic(card: Card, hand: Card[], trumpSuit: GameState["trumpSuit"]): number {
  let h = value(card, trumpSuit);
  if (isTrump(card, trumpSuit)) {
    h += 80; // avoid trump leads when alternatives exist
  } else {
    // Prefer ranks we can follow up with.
    h -= (rankCountInHand(hand, card.rank) - 1) * 8;
  }
  return h;
}

/** Immediate preference for throw-ins (lower is better). */
function throwInHeuristic(
  card: Card,
  state: GameState,
  player: PlayerId,
): number {
  const trumpSuit = state.trumpSuit;
  let h = value(card, trumpSuit);
  const hand = handOf(state, player);
  const emptiesHand = hand.length === 1;

  if (isTrump(card, trumpSuit)) {
    if (emptiesHand || state.takeInProgress) {
      h -= 20; // allow finishing / piling on a take
    } else {
      h += 60; // normally conserve trumps
    }
  }

  if (emptiesHand) h -= 100;
  return h;
}

/** Immediate preference for defense beats (lower is better). */
function defendHeuristic(card: Card, trumpSuit: GameState["trumpSuit"]): number {
  return value(card, trumpSuit);
}

/** Immediate preference for transfers (lower is better — dump awkward cards). */
function transferHeuristic(
  card: Card,
  state: GameState,
  player: PlayerId,
): number {
  const nextDef = seatAfter(state, player, true);
  const nextHand = handOf(state, nextDef).length;
  let h = value(card, state.trumpSuit);
  // Prefer transferring onto a weak next defender.
  if (nextHand <= 2) h -= 40;
  else if (nextHand <= 4) h -= 10;
  // Prefer dumping higher non-trumps via transfer rather than burning them later.
  if (!isTrump(card, state.trumpSuit) && card.rank >= 10) h -= 5;
  return h;
}

interface ScoredMove {
  move: Move;
  /** Lower is better for pre-ranking before search. */
  heuristic: number;
}

function moveKey(move: Move): string {
  switch (move.type) {
    case "ATTACK":
      return `A:${move.card.id}`;
    case "DEFEND":
      return `D:${move.target}:${move.card.id}`;
    case "TRANSFER":
      return `T:${move.target}:${move.card.id}`;
    case "TAKE":
      return "TAKE";
    case "PASS":
      return "PASS";
  }
}

function generateDefenderCandidates(
  state: GameState,
  player: PlayerId,
  difficulty: AiDifficulty,
): ScoredMove[] {
  if (state.takeInProgress) return [];
  const undef = undefendedPairs(state);
  if (undef.length === 0) return [];

  const out: ScoredMove[] = [];
  const seen = new Set<string>();

  const push = (move: Move, heuristic: number) => {
    const key = moveKey(move);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ move, heuristic });
  };

  // Easy give-up: only high-trump beats left with multiple uncovered attacks.
  if (difficulty === "easy" && canTake(state, player)) {
    let anyBeater = false;
    let allHighTrump = true;
    for (const target of undef) {
      const beaters = legalDefenses(state, target);
      if (beaters.length === 0) {
        allHighTrump = false;
        continue;
      }
      anyBeater = true;
      for (const b of beaters) {
        if (!isTrump(b, state.trumpSuit) || b.rank < 10) allHighTrump = false;
      }
    }
    if (anyBeater && allHighTrump && undef.length >= 2) {
      push({ type: "TAKE", player }, -1_000);
      return out;
    }
  }

  for (const target of undef) {
    for (const card of legalTransfers(state, target)) {
      push(
        { type: "TRANSFER", player, card, target },
        transferHeuristic(card, state, player),
      );
    }
    for (const card of legalDefenses(state, target)) {
      push(
        { type: "DEFEND", player, card, target },
        defendHeuristic(card, state.trumpSuit),
      );
    }
  }

  if (canTake(state, player)) {
    // Prefer TAKE only when coverage looks expensive; search decides.
    const cheapestCover = out
      .filter((s) => s.move.type === "DEFEND")
      .reduce((min, s) => Math.min(min, s.heuristic), Infinity);
    const takeBias =
      !Number.isFinite(cheapestCover) ? -50
      : cheapestCover >= 110 ? 5
      : 80;
    push({ type: "TAKE", player }, takeBias);
  }

  // No legal beaters and no transfers → must take.
  if (out.length === 0 && canTake(state, player)) {
    push({ type: "TAKE", player }, 0);
  }

  return out;
}

function generateAttackerCandidates(
  state: GameState,
  player: PlayerId,
  difficulty: AiDifficulty,
): ScoredMove[] {
  const legal = legalAttacks(state, player);
  const out: ScoredMove[] = [];
  const seen = new Set<string>();

  const push = (move: Move, heuristic: number) => {
    const key = moveKey(move);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ move, heuristic });
  };

  // Opening attack.
  if (state.table.length === 0) {
    if (player !== state.attackerId) return [];
    const hand = handOf(state, player);
    for (const card of legal) {
      push(
        { type: "ATTACK", player, card },
        openingHeuristic(card, hand, state.trumpSuit),
      );
    }
    return out;
  }

  const defenderLow = handOf(state, state.defenderId).length <= 2;
  const hand = handOf(state, player);

  for (const card of legal) {
    const trump = isTrump(card, state.trumpSuit);
    const empties = hand.length === 1;

    // Gate weak throw-ins by difficulty; still allow search on survivors.
    if (difficulty === "easy") {
      if (!state.takeInProgress && !(defenderLow && card.rank <= 6 && !trump)) {
        continue;
      }
    } else if (difficulty === "medium") {
      if (
        !state.takeInProgress &&
        !defenderLow &&
        !empties &&
        (trump || card.rank > 9)
      ) {
        continue;
      }
    } else {
      // hard: allow most non-trump dumps; trump only on take / finish / low defender.
      if (trump && !state.takeInProgress && !empties && !defenderLow) {
        continue;
      }
    }

    push(
      { type: "ATTACK", player, card },
      throwInHeuristic(card, state, player),
    );
  }

  if (canPass(state, player)) {
    // Passing is attractive when we have nothing cheap to dump.
    const bestThrow = out.reduce((min, s) => Math.min(min, s.heuristic), Infinity);
    const passH =
      !Number.isFinite(bestThrow) ? 0
      : bestThrow > 12 ? -5
      : 25;
    push({ type: "PASS", player }, passH);
  }

  return out;
}

function generateCandidates(
  state: GameState,
  player: PlayerId,
  difficulty: AiDifficulty,
): ScoredMove[] {
  if (state.phase !== "playing") return [];

  // Empty primary attacker may still PASS after throwing their last card.
  if (handOf(state, player).length === 0) {
    if (!canPass(state, player)) return [];
    return [{ move: { type: "PASS", player }, heuristic: 0 }];
  }

  const raw =
    player === state.defenderId
      ? generateDefenderCandidates(state, player, difficulty)
      : generateAttackerCandidates(state, player, difficulty);

  raw.sort((a, b) => a.heuristic - b.heuristic);
  return raw.slice(0, MAX_CANDIDATES[difficulty]);
}

/** Deterministic mix of state for easy's suboptimal picks. */
function stateHash(state: GameState, player: PlayerId): number {
  let h = player.length * 17 + state.table.length * 31 + state.deck.length * 13;
  for (const c of handOf(state, player)) {
    h = (h * 33 + c.rank * 7 + c.suit.charCodeAt(0)) | 0;
  }
  for (const pair of state.table) {
    h = (h * 19 + pair.attack.rank) | 0;
  }
  return Math.abs(h);
}

/**
 * Score a candidate by applying it and optionally looking ahead at replies.
 * `depth` is remaining opponent plies after this move.
 */
function scoreAfterMove(
  state: GameState,
  player: PlayerId,
  move: Move,
  depth: number,
  difficulty: AiDifficulty,
): number {
  let next: GameState;
  try {
    next = applyMove(state, move);
  } catch {
    return -Infinity;
  }

  let immediate = 0;
  // Opening leads: prefer low non-trumps with follow-up potential (skip deep
  // search — burning an unbeatable ace is often greedily attractive but poor style).
  if (state.table.length === 0 && move.type === "ATTACK") {
    return (
      evaluatePosition(next, player) -
      openingHeuristic(move.card, handOf(state, player), state.trumpSuit) * 10
    );
  }
  // While defender is taking, pile on cheap cards before passing.
  if (state.takeInProgress) {
    if (move.type === "ATTACK") {
      immediate += 70 - value(move.card, state.trumpSuit) * 0.5;
    } else if (move.type === "PASS") {
      immediate -= 35;
    }
  }

  if (depth <= 0 || next.phase === "gameOver") {
    return evaluatePosition(next, player) + immediate;
  }

  // Simulate one reply from the first other seat that can act.
  for (const opp of next.players) {
    if (opp === player) continue;
    const oppCandidates = generateCandidates(next, opp, difficulty);
    if (oppCandidates.length === 0) continue;

    // Opponent picks their best 1-ply evaluation (greedy reply).
    let bestOppScore = -Infinity;
    let bestOppMove = oppCandidates[0]!.move;
    for (const { move: oppMove } of oppCandidates) {
      let afterOpp: GameState;
      try {
        afterOpp = applyMove(next, oppMove);
      } catch {
        continue;
      }
      const oppScore = evaluatePosition(afterOpp, opp);
      if (oppScore > bestOppScore) {
        bestOppScore = oppScore;
        bestOppMove = oppMove;
      }
    }

    let after: GameState;
    try {
      after = applyMove(next, bestOppMove);
    } catch {
      return evaluatePosition(next, player);
    }

    if (depth <= 1 || after.phase === "gameOver") {
      return evaluatePosition(after, player) + immediate;
    }

    // One more ply: our best follow-up by static eval.
    let bestFollow = evaluatePosition(after, player);
    const followUps = generateCandidates(after, player, difficulty);
    for (const { move: follow } of followUps) {
      try {
        const end = applyMove(after, follow);
        bestFollow = Math.max(bestFollow, evaluatePosition(end, player));
      } catch {
        // skip illegal edge cases
      }
    }
    return bestFollow + immediate;
  }

  // No opponent reply — still allow our own continuation (e.g. more throw-ins).
  if (depth >= 1) {
    const followUps = generateCandidates(next, player, difficulty);
    if (followUps.length > 0) {
      let bestFollow = evaluatePosition(next, player);
      for (const { move: follow } of followUps) {
        try {
          const end = applyMove(next, follow);
          bestFollow = Math.max(bestFollow, evaluatePosition(end, player));
        } catch {
          // skip
        }
      }
      return bestFollow + immediate;
    }
  }

  return evaluatePosition(next, player) + immediate;
}

function selectMove(
  state: GameState,
  player: PlayerId,
  candidates: ScoredMove[],
  difficulty: AiDifficulty,
): Move {
  const depth = SEARCH_DEPTH[difficulty];

  const ranked = candidates.map((c) => ({
    move: c.move,
    heuristic: c.heuristic,
    score:
      depth === 0
        ? // Easy / no search: invert heuristic so higher is better.
          -c.heuristic
        : scoreAfterMove(state, player, c.move, depth, difficulty),
  }));

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.heuristic - b.heuristic;
  });

  if (difficulty === "easy" && ranked.length > 1) {
    // Deterministically pick from the worse half so Easy stays beatable.
    const start = Math.floor(ranked.length / 2);
    const idx = start + (stateHash(state, player) % (ranked.length - start));
    return ranked[idx]!.move;
  }

  return ranked[0]!.move;
}

/**
 * Picks a move for an AI-controlled player, or returns null when this player
 * currently has nothing to do (e.g. waiting on the defender). The driver should
 * keep polling players until someone can act.
 */
export function pickMove(
  state: GameState,
  player: PlayerId,
  difficulty: AiDifficulty = "medium",
): Move | null {
  if (state.phase !== "playing") return null;

  const candidates = generateCandidates(state, player, difficulty);
  if (candidates.length === 0) return null;

  return selectMove(state, player, candidates, difficulty);
}

/** Convenience: the set of players an AI driver controls (everyone except humans). */
export function aiSeats(state: GameState, humans: PlayerId[]): PlayerId[] {
  return state.players.filter((p) => !humans.includes(p));
}

export { attackers };
