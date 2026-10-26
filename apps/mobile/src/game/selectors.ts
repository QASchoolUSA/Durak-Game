import {
  type Card,
  type GameState,
  type PlayerId,
  canPass,
  canTake,
  canThrowIn,
  canTransfer,
  legalAttacks,
  legalDefenses,
  legalTransfers,
  undefendedCount,
  undefendedPairs,
} from "@durak/game-core";
import { i18n } from "../i18n/i18n";

export type SeatRole = "attacker" | "defender" | "taking" | null;

export type SeatIndication = "play" | "defend";

export function getSeatRole(state: GameState, playerId: PlayerId): SeatRole {
  if (state.takeInProgress && playerId === state.defenderId) return "taking";
  if (playerId === state.defenderId) return "defender";
  if (playerId === state.attackerId) return "attacker";
  return null;
}

/** Green = play/attack/throw-in; red = beat/transfer/take. */
export function getSeatIndication(
  state: GameState,
  playerId: PlayerId,
  opts?: { mustAct?: boolean; isDefender?: boolean },
): SeatIndication | null {
  const role = getSeatRole(state, playerId);

  if (role === "taking") return "defend";

  if (opts?.mustAct !== undefined) {
    if (!opts.mustAct) return null;
    if (opts.isDefender || role === "defender") return "defend";
    return "play";
  }

  if (role === "defender") return "defend";
  if (role === "attacker") return "play";
  return null;
}

/**
 * Persistent role tag shown under a seat name so every player can see who is
 * attacking, defending, or taking at a glance (independent of the turn clock).
 */
export function seatRoleTag(
  role: SeatRole,
): { label: string; indication: SeatIndication } | null {
  if (role === "attacker") return { label: i18n.t("game.role.attack"), indication: "play" };
  if (role === "defender") return { label: i18n.t("game.role.defend"), indication: "defend" };
  if (role === "taking") return { label: i18n.t("game.role.iTake"), indication: "defend" };
  return null;
}

export type TurnTone =
  | "you-attack"
  | "you-defend"
  | "you-throw"
  | "waiting"
  | "neutral"
  | "confirming"
  | "reconnecting";

export interface TurnStatus {
  text: string;
  tone: TurnTone;
}

/**
 * Human-centric description of the current game state for the status banner:
 * what the local player should do, or who everyone is waiting on.
 */
export function getTurnStatus(
  state: GameState,
  human: PlayerId,
  names: Record<string, string>,
  options?: {
    submittingMove?: boolean;
    opponentReconnecting?: boolean;
  },
): TurnStatus | null {
  if (state.phase !== "playing") return null;

  if (options?.submittingMove) {
    return { text: "Sending move…", tone: "confirming" };
  }
  if (options?.opponentReconnecting) {
    return { text: "Opponent reconnecting…", tone: "reconnecting" };
  }

  const nameOf = (id: PlayerId) => names[id] ?? i18n.t("common.opponent");
  const isDefender = state.defenderId === human;
  const undef = undefendedCount(state);

  if (state.takeInProgress) {
    if (isDefender) return { text: i18n.t("game.status.taking"), tone: "neutral" };
    if (canThrowIn(state, human)) {
      return { text: i18n.t("game.status.throwOrWait"), tone: "you-throw" };
    }
    return {
      text: i18n.t("game.status.nameTaking", { name: nameOf(state.defenderId) }),
      tone: "waiting",
    };
  }

  if (undef > 0) {
    if (isDefender) {
      return {
        text: i18n.t("game.status.yourBeat", { count: undef }),
        tone: "you-defend",
      };
    }
    return {
      text: i18n.t("game.status.waitBeat", {
        name: nameOf(state.defenderId),
        count: undef,
      }),
      tone: "waiting",
    };
  }

  // Nothing unbeaten on the table.
  if (state.table.length === 0) {
    if (human === state.attackerId) {
      return { text: i18n.t("game.status.yourAttack"), tone: "you-attack" };
    }
    return {
      text: i18n.t("game.status.waitAttack", { name: nameOf(state.attackerId) }),
      tone: "waiting",
    };
  }

  // Everything beaten — throw-in window before the bout ends.
  if (canThrowIn(state, human)) {
    return { text: i18n.t("game.status.throwOrDone"), tone: "you-throw" };
  }
  if (isDefender) {
    return { text: i18n.t("game.status.defendedWait"), tone: "neutral" };
  }
  return { text: i18n.t("game.status.waitThrow"), tone: "waiting" };
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

/** True when any player has a legal action right now. */
export function playerMustAct(state: GameState, player: PlayerId): boolean {
  if (state.phase !== "playing") return false;

  const isDefender = state.defenderId === player;
  const attackable = legalAttacks(state, player);

  const defendable: Record<string, number[]> = {};
  if (isDefender && !state.takeInProgress) {
    for (const target of undefendedPairs(state)) {
      for (const card of legalDefenses(state, target)) {
        (defendable[card.id] ??= []).push(target);
      }
    }
  }

  const take = canTake(state, player);
  const pass = canPass(state, player);
  const transfer = canTransfer(state, player);
  const mustOpen = !isDefender && state.table.length === 0 && attackable.length > 0;

  return (
    take ||
    pass ||
    transfer ||
    mustOpen ||
    Object.keys(defendable).length > 0 ||
    (attackable.length > 0 && state.table.length > 0)
  );
}

/** Forced actions only — mirrors game-core humanForcedAct for UI / tests. */
export { humanForcedAct } from "@durak/game-core";

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
    }
    for (const card of legalTransfers(state, 0)) {
      (transferable[card.id] ??= []).push(0);
    }
  }

  const take = canTake(state, human);
  const pass = canPass(state, human);
  const transfer = canTransfer(state, human);
  const mustOpen = isAttacker && state.table.length === 0 && attackable.length > 0;
  const mustAct = playerMustAct(state, human);

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
  const transferCandidates: number[] = [];

  state.table.forEach((pair, i) => {
    if (pair.defense) return;
    const canBeat = Object.values(view.defendable).some((targets) => targets.includes(i));
    const canXfer =
      view.canTransfer &&
      Object.values(view.transferable).some((targets) => targets.includes(i));
    if (canBeat || canXfer) {
      choiceIndices.push(i);
      if (canXfer) transferCandidates.push(i);
    }
  });

  /** One shared transfer drop zone — always anchored to the opening table index. */
  const transferIndices =
    transferCandidates.length > 0 ? [Math.min(...transferCandidates)] : [];

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

export function canReveal(state: GameState, human: PlayerId): boolean {
  if (state.phase !== "playing") return false;
  return revealEligibleOpponents(state, human).length > 0;
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
  if (players <= 2) return i18n.t("game.rulesLabel.allThrow");
  return scope === "all"
    ? i18n.t("game.rulesLabel.allThrow")
    : i18n.t("game.rulesLabel.neighborThrow");
}

export function formatRulesLabel(state: GameState): string {
  const mode =
    state.rules.variant === "podkidnoy"
      ? i18n.t("config.podkidnoy")
      : i18n.t("config.perevodnoy");
  const style =
    state.rules.playStyle === "abilities"
      ? i18n.t("lobby.playStyle.abilities")
      : i18n.t("lobby.playStyle.standard");
  return `${mode} · ${formatThrowIn(state.rules.throwInScope, state.players.length)} · ${style}`;
}
