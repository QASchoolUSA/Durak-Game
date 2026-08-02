import { describe, expect, it } from "vitest";
import {
  activeHumanPlayer,
  cardId,
  humanForcedAct,
  humanMustAct,
  timeoutMoveFor,
  type Card,
  type GameState,
} from "../src/index";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

function baseState(partial: Partial<GameState>): GameState {
  return {
    players: ["p0", "p1", "p2"],
    hands: { p0: [], p1: [], p2: [] },
    deck: [],
    trumpSuit: "spades",
    trumpCard: c(6, "spades"),
    table: [],
    discard: [],
    attackerId: "p0",
    defenderId: "p1",
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
  it("returns TAKE for defender with undefended attack", () => {
    const state = baseState({
      hands: {
        p0: [c(9, "hearts")],
        p1: [c(10, "clubs")],
        p2: [c(7, "diamonds")],
      },
      table: [{ attack: c(9, "clubs") }],
    });
    expect(timeoutMoveFor(state, "p1")).toEqual({ type: "TAKE", player: "p1" });
  });

  it("returns null for throw-in-only attacker", () => {
    const state = baseState({
      hands: {
        p0: [c(9, "hearts"), c(10, "diamonds")],
        p1: [c(8, "hearts"), c(11, "clubs")],
        p2: [c(7, "diamonds")],
      },
      table: [{ attack: c(9, "clubs") }],
    });
    expect(timeoutMoveFor(state, "p0")).toBeNull();
  });
});

describe("humanForcedAct / activeHumanPlayer", () => {
  it("treats throw-in as optional, not forced", () => {
    const state = baseState({
      hands: {
        p0: [c(9, "hearts"), c(10, "diamonds")],
        p1: [c(8, "hearts"), c(11, "clubs")],
        p2: [c(7, "diamonds")],
      },
      table: [{ attack: c(9, "clubs") }],
    });

    expect(humanForcedAct(state, "p0")).toBe(false);
    expect(humanMustAct(state, "p0")).toBe(true);
    expect(humanForcedAct(state, "p1")).toBe(true);
  });

  it("prefers forced defender over throw-in attacker for the clock", () => {
    // Player order lists attacker first — old activeHumanPlayer stalled here.
    const state = baseState({
      players: ["p0", "p1"],
      attackerId: "p0",
      defenderId: "p1",
      hands: {
        p0: [c(9, "hearts"), c(10, "diamonds")],
        p1: [c(8, "hearts"), c(11, "clubs")],
      },
      table: [{ attack: c(9, "clubs") }],
    });

    const bots = new Set<string>();
    expect(activeHumanPlayer(state, bots)).toBe("p1");
    expect(timeoutMoveFor(state, "p1")).toEqual({ type: "TAKE", player: "p1" });
  });

  it("forcedOnly skips optional throw-in seats after a null timeout", () => {
    const state = baseState({
      players: ["p0", "p1"],
      attackerId: "p0",
      defenderId: "p1",
      hands: {
        p0: [c(9, "hearts")],
        p1: [],
      },
      // Fully covered — defender cannot take; attacker can pass (forced).
      table: [{ attack: c(9, "clubs"), defense: c(10, "clubs") }],
    });

    // Make p0 unable to pass somehow? With covered table, canPass is true.
    // Optional-only case: undefended, defender is a bot, human is throw-in only.
    const throwInOnly = baseState({
      players: ["p0", "bot1"],
      attackerId: "p0",
      defenderId: "bot1",
      hands: {
        p0: [c(9, "hearts"), c(10, "diamonds")],
        bot1: [c(8, "hearts"), c(11, "clubs")],
      },
      table: [{ attack: c(9, "clubs") }],
    });

    const bots = new Set(["bot1"]);
    expect(activeHumanPlayer(throwInOnly, bots)).toBe("p0");
    expect(activeHumanPlayer(throwInOnly, bots, { forcedOnly: true })).toBeNull();
    expect(timeoutMoveFor(throwInOnly, "p0")).toBeNull();
    // Covered-table sanity: forced pass still selected.
    expect(activeHumanPlayer(state, new Set())).toBe("p0");
    expect(timeoutMoveFor(state, "p0")).toEqual({ type: "PASS", player: "p0" });
  });
});
