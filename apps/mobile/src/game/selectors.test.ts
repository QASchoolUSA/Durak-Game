import { describe, expect, it } from "vitest";
import { cardId, type Card, type GameState } from "@durak/game-core";
import { getBeatTransferChoice, getHumanView } from "./selectors";

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

  it("is inactive after a throw-in", () => {
    const state = baseState({
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(9, "diamonds"), c(10, "clubs")],
        bot2: [c(10, "hearts"), c(8, "clubs")],
      },
      table: [{ attack: c(9, "clubs") }, { attack: c(9, "hearts") }],
    });
    const view = getHumanView(state, "you");
    expect(getBeatTransferChoice(state, view).active).toBe(false);
  });
});
