import type { Card, GameState, PlayerId, Suit } from "./types";

export function isTrump(card: Card, trumpSuit: Suit): boolean {
  return card.suit === trumpSuit;
}

/**
 * Does `defense` beat `attack` given the trump suit?
 * - same suit: higher rank wins
 * - any trump beats any non-trump
 * - trump vs trump: higher rank wins
 * - otherwise: no
 */
export function beats(defense: Card, attack: Card, trumpSuit: Suit): boolean {
  const defTrump = isTrump(defense, trumpSuit);
  const atkTrump = isTrump(attack, trumpSuit);

  if (defense.suit === attack.suit) {
    return defense.rank > attack.rank;
  }
  if (defTrump && !atkTrump) {
    return true;
  }
  return false;
}

export function sameId(a: Card, b: Card): boolean {
  return a.id === b.id;
}

export function handOf(state: GameState, player: PlayerId): Card[] {
  return state.hands[player] ?? [];
}

export function seatAfter(
  state: GameState,
  fromId: PlayerId,
  inPlayOnly: boolean,
): PlayerId {
  const n = state.players.length;
  const start = state.players.indexOf(fromId);
  for (let k = 1; k <= n; k++) {
    const p = state.players[(start + k) % n]!;
    if (!inPlayOnly || handOf(state, p).length > 0) return p;
  }
  return fromId;
}

export function seatBefore(state: GameState, fromId: PlayerId): PlayerId {
  const n = state.players.length;
  const start = state.players.indexOf(fromId);
  return state.players[(start - 1 + n) % n]!;
}

/** True when `player` sits immediately left or right of the defender. */
export function isNeighborOfDefender(state: GameState, player: PlayerId): boolean {
  if (player === state.defenderId) return false;
  const before = seatBefore(state, state.defenderId);
  const after = seatAfter(state, state.defenderId, false);
  return player === before || player === after;
}

/** Whether `player` may throw in a matching rank this round. */
export function canThrowIn(state: GameState, player: PlayerId): boolean {
  if (player === state.defenderId) return false;
  if (handOf(state, player).length === 0) return false;
  if (state.rules.throwInScope === "all") return true;
  return isNeighborOfDefender(state, player);
}

/** Players still in the game (holding cards), excluding the defender. */
export function attackers(state: GameState): PlayerId[] {
  return state.players.filter(
    (p) => p !== state.defenderId && handOf(state, p).length > 0,
  );
}

export function undefendedPairs(state: GameState): number[] {
  const idx: number[] = [];
  state.table.forEach((pair, i) => {
    if (!pair.defense) idx.push(i);
  });
  return idx;
}

export function undefendedCount(state: GameState): number {
  return state.table.reduce((n, p) => (p.defense ? n : n + 1), 0);
}

/** Distinct ranks already present on the table (attack or defense cards). */
export function tableRanks(state: GameState): Set<number> {
  const ranks = new Set<number>();
  for (const pair of state.table) {
    ranks.add(pair.attack.rank);
    if (pair.defense) ranks.add(pair.defense.rank);
  }
  return ranks;
}

/**
 * Cards `player` may legally play as an attack/throw-in right now.
 * - empty table: only the primary attacker, any card
 * - non-empty table: eligible throwers only, matching ranks,
 *   subject to the round cap and the defender's capacity to respond.
 */
export function legalAttacks(state: GameState, player: PlayerId): Card[] {
  if (state.phase !== "playing") return [];

  const hand = handOf(state, player);
  if (hand.length === 0) return [];

  // Opening attack.
  if (state.table.length === 0) {
    if (player !== state.attackerId || state.takeInProgress) return [];
    return hand.slice();
  }

  // Throw-in: must be eligible and not the defender.
  if (player === state.defenderId || !canThrowIn(state, player)) return [];

  if (state.table.length >= state.maxAttacks) return [];

  if (state.takeInProgress) {
    // Defender will scoop everything; only the global cap and rank match apply.
    const ranks = tableRanks(state);
    return hand.filter((c) => ranks.has(c.rank));
  }

  // Can't pile on more undefended attacks than the defender can possibly beat.
  const defenderHand = handOf(state, state.defenderId).length;
  if (undefendedCount(state) >= defenderHand) return [];

  const ranks = tableRanks(state);
  return hand.filter((c) => ranks.has(c.rank));
}

/** For a given undefended attack, the defender's cards that can beat it. */
export function legalDefenses(
  state: GameState,
  target: number,
): Card[] {
  if (state.phase !== "playing" || state.takeInProgress) return [];
  const pair = state.table[target];
  if (!pair || pair.defense) return [];
  const hand = handOf(state, state.defenderId);
  return hand.filter((c) => beats(c, pair.attack, state.trumpSuit));
}

/** True while defenders may keep passing the attack via matching-rank transfers. */
export function transferChainActive(state: GameState): boolean {
  if (state.table.length === 0) return false;
  if (state.table.some((p) => p.defense)) return false;
  if (state.table.length === 1) return true;
  const openingRank = state.table[0]!.attack.rank;
  for (let i = 1; i < state.table.length; i++) {
    const p = state.table[i]!;
    if (!p.viaTransfer || p.attack.rank !== openingRank) return false;
  }
  return true;
}

/**
 * Perevodnoy: defender plays same rank to pass defense to the next seat.
 * Allowed on the opening attack or while the chain has only transfer-added cards.
 */
export function legalTransfers(state: GameState, target: number): Card[] {
  if (state.rules.variant !== "perevodnoy") return [];
  if (state.phase !== "playing" || state.takeInProgress) return [];
  if (!transferChainActive(state)) return [];

  const pair = state.table[target];
  if (!pair || pair.defense) return [];

  const nextDef = seatAfter(state, state.defenderId, true);
  const futureUndefended = undefendedCount(state) + 1;
  if (handOf(state, nextDef).length < futureUndefended) return [];

  const hand = handOf(state, state.defenderId);
  return hand.filter((c) => c.rank === pair.attack.rank);
}

export function canTransfer(state: GameState, player: PlayerId): boolean {
  if (player !== state.defenderId) return false;
  for (const target of undefendedPairs(state)) {
    if (legalTransfers(state, target).length > 0) return true;
  }
  return false;
}

export function canTake(state: GameState, player: PlayerId): boolean {
  return (
    state.phase === "playing" &&
    player === state.defenderId &&
    !state.takeInProgress &&
    state.table.length > 0
  );
}

/** An attacker may declare "done" only when there are no undefended attacks waiting. */
export function canPass(state: GameState, player: PlayerId): boolean {
  if (state.phase !== "playing") return false;
  if (player === state.defenderId) return false;
  if (handOf(state, player).length === 0 && player !== state.attackerId) {
    // A finished attacker is implicitly passed.
    return false;
  }
  if (state.table.length === 0) return false;
  if (state.passed.includes(player)) return false;
  if (!state.takeInProgress && undefendedCount(state) > 0) return false;
  return true;
}
