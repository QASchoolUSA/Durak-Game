import { describe, expect, it } from "vitest";
import { cardId, type Card, type GameState } from "@durak/game-core";
import {
  canReveal,
  getBeatTransferChoice,
  getHumanView,
  getSeatIndication,
  getSeatRole,
  getTurnStatus,
  playerMustAct,
  seatRoleTag,
} from "./selectors";

const NAMES = { bot1: "Alex", you: "You", bot2: "Bo" };

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

function baseState(partial: Partial<GameState>): GameState {
  return {
    players: ["bot1", "you", "bot2"],
    hands: { bot1: [], you: [], bot2: [] },
    deck: [],
    trumpSuit: "spades",
    trumpCard: c(6, "spades"),
    table: [],
    discard: [],
    attackerId: "bot1",
    defenderId: "you",
    takeInProgress: false,
    passed: [],
    finishedOrder: [],
    loserId: null,
    phase: "playing",
    maxAttacks: 6,
    rules: { variant: "perevodnoy", throwInScope: "all", playStyle: "standard" },
    ...partial,
  };
}

describe("getBeatTransferChoice", () => {
  it("shows dual slots on opening defend when beat is available", () => {
    const state = baseState({
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(10, "clubs"), c(7, "hearts")],
        bot2: [c(10, "hearts"), c(8, "clubs")],
      },
      table: [{ attack: c(9, "clubs") }],
    });
    const view = getHumanView(state, "you");
    const choice = getBeatTransferChoice(state, view);
    expect(choice.active).toBe(true);
    expect(choice.choiceIndices).toEqual([0]);
    expect(choice.transferIndices).toEqual([]);
  });

  it("includes transfer index when transfer is legal", () => {
    const state = baseState({
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(9, "diamonds"), c(10, "clubs"), c(7, "hearts")],
        bot2: [c(10, "hearts"), c(8, "clubs")],
      },
      table: [{ attack: c(9, "clubs") }],
    });
    const view = getHumanView(state, "you");
    const choice = getBeatTransferChoice(state, view);
    expect(choice.active).toBe(true);
    expect(choice.choiceIndices).toEqual([0]);
    expect(choice.transferIndices).toEqual([0]);
  });

  it("shows transfer slot after a chained transfer", () => {
    const state = baseState({
      defenderId: "you",
      hands: {
        bot1: [c(9, "hearts"), c(7, "hearts"), c(8, "hearts")],
        you: [c(9, "spades"), c(10, "clubs")],
        bot2: [c(9, "diamonds"), c(8, "clubs"), c(6, "clubs")],
      },
      table: [
        { attack: c(9, "clubs") },
        { attack: c(9, "diamonds"), viaTransfer: true },
      ],
    });
    const view = getHumanView(state, "you");
    const choice = getBeatTransferChoice(state, view);
    expect(choice.active).toBe(true);
    expect(choice.transferIndices).toEqual([0]);
  });

  it("disallows transfer after a throw-in", () => {
    const state = baseState({
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(9, "diamonds"), c(10, "clubs")],
        bot2: [c(10, "hearts"), c(8, "clubs")],
      },
      table: [{ attack: c(9, "clubs") }, { attack: c(9, "hearts") }],
    });
    const view = getHumanView(state, "you");
    expect(getBeatTransferChoice(state, view).transferIndices).toEqual([]);
  });

  it("maps transferable cards only to the opening index on a 3-card chain", () => {
    const state = baseState({
      defenderId: "you",
      hands: {
        bot1: [c(7, "hearts"), c(8, "hearts")],
        you: [c(9, "spades"), c(10, "clubs")],
        bot2: [c(11, "clubs"), c(12, "clubs"), c(13, "clubs"), c(14, "clubs"), c(6, "diamonds")],
      },
      table: [
        { attack: c(9, "clubs") },
        { attack: c(9, "diamonds"), viaTransfer: true },
        { attack: c(9, "hearts"), viaTransfer: true },
      ],
    });
    const view = getHumanView(state, "you");
    expect(view.canTransfer).toBe(true);
    expect(view.transferable[c(9, "spades").id]).toEqual([0]);
    expect(getBeatTransferChoice(state, view).transferIndices).toEqual([0]);
  });

  it("shows beat slots on every undefended card but transfer only on the opening card", () => {
    const state = baseState({
      defenderId: "you",
      hands: {
        bot1: [c(7, "hearts"), c(8, "hearts")],
        you: [c(9, "spades"), c(11, "spades")],
        bot2: [c(12, "clubs"), c(13, "clubs"), c(14, "clubs"), c(6, "diamonds"), c(7, "diamonds")],
      },
      table: [
        { attack: c(9, "clubs") },
        { attack: c(9, "diamonds"), viaTransfer: true },
        { attack: c(9, "hearts"), viaTransfer: true },
      ],
    });
    const view = getHumanView(state, "you");
    const choice = getBeatTransferChoice(state, view);
    expect(choice.choiceIndices).toEqual([0, 1, 2]);
    expect(choice.transferIndices).toEqual([0]);
    expect(view.transferable[c(9, "spades").id]).toEqual([0]);
  });
});

describe("getSeatRole", () => {
  it("returns taking when defender chose to take", () => {
    const state = baseState({
      defenderId: "you",
      takeInProgress: true,
      table: [{ attack: c(9, "clubs") }],
    });
    expect(getSeatRole(state, "you")).toBe("taking");
  });

  it("returns defender when not taking", () => {
    const state = baseState({ defenderId: "you", takeInProgress: false });
    expect(getSeatRole(state, "you")).toBe("defender");
  });

  it("returns attacker for primary attacker", () => {
    const state = baseState({ attackerId: "bot1", defenderId: "you" });
    expect(getSeatRole(state, "bot1")).toBe("attacker");
  });

  it("returns null for non-role player", () => {
    const state = baseState({
      attackerId: "bot1",
      defenderId: "you",
      players: ["bot1", "you", "bot2"],
    });
    expect(getSeatRole(state, "bot2")).toBe(null);
  });

  it("taking overrides defender for the scooping player", () => {
    const state = baseState({
      attackerId: "bot1",
      defenderId: "bot2",
      takeInProgress: true,
      hands: { bot1: [], you: [], bot2: [c(6, "hearts")] },
      table: [{ attack: c(9, "clubs") }],
    });
    expect(getSeatRole(state, "bot2")).toBe("taking");
    expect(getSeatRole(state, "bot1")).toBe("attacker");
  });
});

describe("playerMustAct", () => {
  it("returns true for opening attacker with empty table", () => {
    const state = baseState({
      attackerId: "you",
      defenderId: "bot1",
      hands: {
        you: [c(6, "hearts")],
        bot1: [c(7, "clubs")],
        bot2: [],
      },
      table: [],
    });
    expect(playerMustAct(state, "you")).toBe(true);
    expect(playerMustAct(state, "bot1")).toBe(false);
  });

  it("returns true for throw-in attacker", () => {
    const state = baseState({
      attackerId: "bot1",
      defenderId: "bot2",
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(9, "diamonds"), c(10, "clubs")],
        bot2: [c(8, "clubs"), c(7, "hearts")],
      },
      table: [{ attack: c(9, "clubs") }],
    });
    expect(playerMustAct(state, "you")).toBe(true);
    expect(playerMustAct(state, "bot2")).toBe(true);
  });

  it("returns false when no legal action", () => {
    const state = baseState({
      attackerId: "bot1",
      defenderId: "you",
      hands: { bot1: [c(9, "hearts")], you: [c(7, "clubs")], bot2: [] },
      table: [],
    });
    expect(playerMustAct(state, "you")).toBe(false);
  });
});

describe("getSeatIndication", () => {
  it("returns defend when defender is taking cards", () => {
    const state = baseState({
      defenderId: "you",
      takeInProgress: true,
      table: [{ attack: c(9, "clubs") }],
    });
    expect(getSeatIndication(state, "you")).toBe("defend");
  });

  it("returns play for human throw-in with mustAct", () => {
    const state = baseState({
      attackerId: "bot1",
      defenderId: "bot2",
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(9, "diamonds"), c(10, "clubs")],
        bot2: [c(8, "clubs"), c(7, "hearts")],
      },
      table: [{ attack: c(9, "clubs") }],
    });
    const view = getHumanView(state, "you");
    expect(view.mustAct).toBe(true);
    expect(view.isDefender).toBe(false);
    expect(getSeatIndication(state, "you", { mustAct: view.mustAct, isDefender: view.isDefender })).toBe(
      "play",
    );
  });
});

describe("canReveal", () => {
  it("allows reveal off-turn when opponents are eligible", () => {
    const state = baseState({
      attackerId: "bot1",
      defenderId: "bot2",
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(6, "spades")],
        bot2: [c(10, "clubs"), c(7, "diamonds")],
      },
      table: [{ attack: c(9, "clubs") }],
    });
    const view = getHumanView(state, "you");
    expect(view.mustAct).toBe(false);
    expect(canReveal(state, "you")).toBe(true);
  });

  it("returns false when no eligible opponents remain", () => {
    const state = baseState({
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(6, "spades")],
        bot2: [c(10, "clubs")],
      },
    });
    expect(canReveal(state, "you")).toBe(false);
  });
});

describe("seatRoleTag", () => {
  it("labels attacker and defender, omits taking/none", () => {
    expect(seatRoleTag("attacker")).toEqual({ label: "ATTACK", indication: "play" });
    expect(seatRoleTag("defender")).toEqual({ label: "DEFEND", indication: "defend" });
    expect(seatRoleTag("taking")).toBeNull();
    expect(seatRoleTag(null)).toBeNull();
  });
});

describe("getTurnStatus", () => {
  it("returns null when the game is not playing", () => {
    const state = baseState({ phase: "gameOver" });
    expect(getTurnStatus(state, "you", NAMES)).toBeNull();
  });

  it("prompts you to attack when you open with an empty table", () => {
    const state = baseState({
      attackerId: "you",
      defenderId: "bot1",
      hands: { bot1: [], you: [c(9, "hearts")], bot2: [] },
      table: [],
    });
    expect(getTurnStatus(state, "you", NAMES)).toEqual({
      text: "Your turn — attack",
      tone: "you-attack",
    });
  });

  it("names the attacker you are waiting on", () => {
    const state = baseState({
      attackerId: "bot1",
      defenderId: "bot2",
      hands: { bot1: [c(9, "hearts")], you: [], bot2: [] },
      table: [],
    });
    expect(getTurnStatus(state, "you", NAMES)).toEqual({
      text: "Waiting for Alex to attack",
      tone: "waiting",
    });
  });

  it("tells the defender how many cards to beat (singular/plural)", () => {
    const one = baseState({
      defenderId: "you",
      table: [{ attack: c(9, "clubs") }],
    });
    expect(getTurnStatus(one, "you", NAMES)).toEqual({
      text: "Your turn — beat 1 card",
      tone: "you-defend",
    });

    const two = baseState({
      defenderId: "you",
      table: [{ attack: c(9, "clubs") }, { attack: c(9, "hearts") }],
    });
    expect(getTurnStatus(two, "you", NAMES)).toEqual({
      text: "Your turn — beat 2 cards",
      tone: "you-defend",
    });
  });

  it("names the defender others are waiting on", () => {
    const state = baseState({
      attackerId: "you",
      defenderId: "bot2",
      hands: { bot1: [], you: [c(10, "clubs")], bot2: [c(11, "clubs")] },
      table: [{ attack: c(9, "clubs") }],
    });
    expect(getTurnStatus(state, "you", NAMES)).toEqual({
      text: "Waiting for Bo to beat 1 card",
      tone: "waiting",
    });
  });

  it("invites an eligible attacker to throw in once everything is beaten", () => {
    const state = baseState({
      attackerId: "you",
      defenderId: "bot1",
      hands: { bot1: [], you: [c(9, "hearts")], bot2: [] },
      table: [{ attack: c(9, "clubs"), defense: c(10, "clubs") }],
    });
    expect(getTurnStatus(state, "you", NAMES)).toEqual({
      text: "Throw in a matching card or press DONE",
      tone: "you-throw",
    });
  });

  it("tells the defender they have defended and are waiting", () => {
    const state = baseState({
      attackerId: "bot1",
      defenderId: "you",
      hands: { bot1: [c(7, "hearts")], you: [], bot2: [c(8, "hearts")] },
      table: [{ attack: c(9, "clubs"), defense: c(10, "clubs") }],
    });
    expect(getTurnStatus(state, "you", NAMES)).toEqual({
      text: "Defended — waiting for attackers",
      tone: "neutral",
    });
  });

  it("describes take-in-progress for both the taker and the others", () => {
    const taker = baseState({
      defenderId: "you",
      takeInProgress: true,
      table: [{ attack: c(9, "clubs") }],
    });
    expect(getTurnStatus(taker, "you", NAMES)).toEqual({
      text: "Taking the cards",
      tone: "neutral",
    });

    const other = baseState({
      attackerId: "bot1",
      defenderId: "bot2",
      takeInProgress: true,
      hands: { bot1: [], you: [], bot2: [] },
      table: [{ attack: c(9, "clubs") }],
    });
    expect(getTurnStatus(other, "you", NAMES)).toEqual({
      text: "Bo is taking the cards",
      tone: "waiting",
    });
  });
});
