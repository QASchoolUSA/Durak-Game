import { describe, expect, it } from "vitest";
import { cardId, type Card, type GameState } from "@durak/game-core";
import { timeoutMoveFor } from "./autoMove";

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

describe("timeoutMoveFor", () => {
  it("defender takes even when transfer is legal", () => {
    const state = baseState({
      hands: {
        bot1: [c(9, "hearts")],
        you: [c(9, "diamonds"), c(10, "clubs"), c(7, "hearts")],
        bot2: [c(10, "hearts"), c(8, "clubs")],
      },
      table: [{ attack: c(9, "clubs") }],
    });

    expect(timeoutMoveFor(state, "you")).toEqual({ type: "TAKE", player: "you" });
  });

  it("attacker passes when done is legal", () => {
    const state = baseState({
      attackerId: "you",
      defenderId: "bot1",
      hands: {
        bot1: [c(8, "hearts")],
        you: [c(9, "hearts"), c(10, "clubs")],
        bot2: [c(7, "diamonds")],
      },
      table: [{ attack: c(9, "clubs"), defense: c(10, "spades") }],
    });

    expect(timeoutMoveFor(state, "you")).toEqual({ type: "PASS", player: "you" });
  });

  it("opening attacker plays lowest legal card", () => {
    const state = baseState({
      attackerId: "you",
      defenderId: "bot1",
      hands: {
        bot1: [c(8, "hearts"), c(11, "clubs")],
        you: [c(9, "hearts"), c(14, "diamonds")],
        bot2: [c(7, "diamonds")],
      },
      table: [],
    });

    const move = timeoutMoveFor(state, "you");
    expect(move?.type).toBe("ATTACK");
    if (move?.type === "ATTACK") {
      expect(move.card.rank).toBe(9);
    }
  });

  it("returns null when attacker must throw in and cannot pass", () => {
    const state = baseState({
      attackerId: "you",
      defenderId: "bot1",
      hands: {
        bot1: [c(8, "hearts"), c(11, "clubs")],
        you: [c(9, "hearts"), c(10, "diamonds")],
        bot2: [c(7, "diamonds")],
      },
      table: [{ attack: c(9, "clubs") }],
    });

    expect(timeoutMoveFor(state, "you")).toBeNull();
  });
});
