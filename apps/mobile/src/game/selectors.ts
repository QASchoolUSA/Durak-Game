import {
  type Card,
  type GameState,
  type PlayerId,
  canPass,
  canTake,
  canTransfer,
  legalAttacks,
  legalDefenses,
  legalTransfers,
  undefendedCount,
  undefendedPairs,
} from "@durak/game-core";

export type SeatRole = "attacker" | "defender" | "taking" | null;

export function getSeatRole(state: GameState, playerId: PlayerId): SeatRole {
  if (state.takeInProgress && playerId === state.defenderId) return "taking";
  if (playerId === state.defenderId) return "defender";
  if (playerId === state.attackerId) return "attacker";
  return null;
}

export interface HumanView {
  isDefender: boolean;
  isAttacker: boolean;
  /** Cards the human can legally throw onto the table right now. */
  attackable: Card[];
  /** Map of card id -> the table index it can defend (for drag targeting). */
  defendable: Record<string, number[]>;
  /** Map of card id -> table index for perevodnoy transfer. */
  transferable: Record<string, number[]>;
  canTake: boolean;
  canPass: boolean;
  canTransfer: boolean;
  /** True when the table is empty and the human must open the attack. */
  mustOpen: boolean;
  /** True when the human has any pending action this instant. */
  mustAct: boolean;
}

export function getHumanView(state: GameState, human: PlayerId): HumanView {
  const isDefender = state.defenderId === human;
  const isAttacker = !isDefender;

  const attackable = legalAttacks(state, human);

  const defendable: Record<string, number[]> = {};
  const transferable: Record<string, number[]> = {};
  if (isDefender && !state.takeInProgress) {
    for (const target of undefendedPairs(state)) {
      for (const card of legalDefenses(state, target)) {
        (defendable[card.id] ??= []).push(target);
      }
      for (const card of legalTransfers(state, target)) {
        (transferable[card.id] ??= []).push(target);
      }
    }
  }

  const take = canTake(state, human);
  const pass = canPass(state, human);
  const transfer = canTransfer(state, human);
  const mustOpen = isAttacker && state.table.length === 0 && attackable.length > 0;

  const mustAct =
    state.phase === "playing" &&
    (take ||
      pass ||
      transfer ||
      mustOpen ||
      Object.keys(defendable).length > 0 ||
      (attackable.length > 0 && state.table.length > 0));

  return {
    isDefender,
    isAttacker,
    attackable,
    defendable,
    transferable,
    canTake: take,
    canPass: pass,
    canTransfer: transfer,
    mustOpen,
    mustAct,
  };
}

export interface BeatTransferChoice {
  /** Show dual-slot beat/transfer chrome on the table. */
  active: boolean;
  /** Table indices that use the dual-slot layout (beat + transfer signs). */
  choiceIndices: number[];
  /** Table indices where transfer drop is legal. */
  transferIndices: number[];
}

/** Perevodnoy opening defend — show beat/transfer slot signs on the table. */
export function getBeatTransferChoice(
  state: GameState,
  view: HumanView,
): BeatTransferChoice {
  const empty: BeatTransferChoice = {
    active: false,
    choiceIndices: [],
    transferIndices: [],
  };
  if (state.rules.variant !== "perevodnoy") return empty;
  if (!view.isDefender || state.takeInProgress || undefendedCount(state) === 0) {
    return empty;
  }

  const choiceIndices: number[] = [];
  const transferIndices: number[] = [];

  state.table.forEach((pair, i) => {
    if (pair.defense) return;
    const canBeat = Object.values(view.defendable).some((targets) => targets.includes(i));
    const canXfer =
      view.canTransfer &&
      Object.values(view.transferable).some((targets) => targets.includes(i));
    if (canBeat || canXfer) {
      choiceIndices.push(i);
      if (canXfer) transferIndices.push(i);
    }
  });

  return { active: choiceIndices.length > 0, choiceIndices, transferIndices };
}

/** Opponents the human can reveal from (2+ cards, still in play). */
export function revealEligibleOpponents(state: GameState, human: PlayerId): PlayerId[] {
  return state.players.filter(
    (id) =>
      id !== human &&
      !state.finishedOrder.includes(id) &&
      (state.hands[id]?.length ?? 0) > 1,
  );
}

export function canReveal(state: GameState, human: PlayerId, view: HumanView): boolean {
  return view.mustAct && revealEligibleOpponents(state, human).length > 0;
}

/** Opponents arranged clockwise starting from the seat after the human. */
export function opponentOrder(state: GameState, human: PlayerId): PlayerId[] {
  const n = state.players.length;
  const start = state.players.indexOf(human);
  const out: PlayerId[] = [];
  for (let k = 1; k < n; k++) {
    out.push(state.players[(start + k) % n]!);
  }
  return out;
}

function formatThrowIn(scope: GameState["rules"]["throwInScope"], players: number): string {
  if (players <= 2) return "All throw-in";
  return scope === "all" ? "All throw-in" : "Neighbor throw-in";
}

export function formatRulesLabel(state: GameState): string {
  const mode = state.rules.variant === "podkidnoy" ? "Podkidnoy" : "Perevodnoy";
  const style = state.rules.playStyle === "abilities" ? "Abilities" : "Standard";
  return `${mode} · ${formatThrowIn(state.rules.throwInScope, state.players.length)} · ${style}`;
}
