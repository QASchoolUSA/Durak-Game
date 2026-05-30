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
  undefendedPairs,
} from "@durak/game-core";

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
  return `${mode} · ${formatThrowIn(state.rules.throwInScope, state.players.length)}`;
}
