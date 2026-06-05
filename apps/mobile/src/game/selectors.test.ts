import { describe, expect, it } from "vitest";
import { cardId, type Card, type GameState } from "@durak/game-core";
import { getBeatTransferChoice, getHumanView, getSeatRole } from "./selectors";

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
