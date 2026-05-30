import { describe, expect, it } from "vitest";
import { cardId, DEFAULT_RULES, legalAttacks } from "../src/index";
import type { Card, GameState, Rank, Suit } from "../src/index";

function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

function baseState(partial: Partial<GameState>): GameState {
  return {
    players: ["A", "B", "C", "D"],
    hands: { A: [], B: [], C: [], D: [] },
    deck: [],
    trumpSuit: "spades",
    trumpCard: makeCard(6, "spades"),
    table: [],
    discard: [],
    attackerId: "A",
    defenderId: "B",
    takeInProgress: false,
    passed: [],
    finishedOrder: [],
    loserId: null,
    phase: "playing",
    maxAttacks: 6,
    rules: DEFAULT_RULES,
    ...partial,
  };
}

describe("throw-in scope", () => {
  const table = [{ attack: makeCard(9, "hearts") }];

  it("allows any attacker to throw in when scope is all", () => {
    const state = baseState({
      rules: { variant: "podkidnoy", throwInScope: "all" },
      hands: {
        A: [makeCard(9, "clubs")],
        B: [makeCard(10, "diamonds"), makeCard(8, "hearts"), makeCard(7, "clubs")],
        C: [makeCard(9, "diamonds")],
        D: [makeCard(9, "spades")],
      },
      table,
    });
    expect(legalAttacks(state, "A").map((c) => c.id)).toContain(cardId(9, "clubs"));
    expect(legalAttacks(state, "C").map((c) => c.id)).toContain(cardId(9, "diamonds"));
    expect(legalAttacks(state, "D").map((c) => c.id)).toContain(cardId(9, "spades"));
  });

  it("restricts throw-ins to defender neighbors when scope is neighbor", () => {
    const state = baseState({
      rules: { variant: "podkidnoy", throwInScope: "neighbor" },
      hands: {
        A: [makeCard(9, "clubs")],
        B: [makeCard(10, "diamonds"), makeCard(8, "hearts"), makeCard(7, "clubs")],
        C: [makeCard(9, "diamonds")],
        D: [makeCard(9, "spades")],
      },
      table,
    });
    // B is defender; neighbors are A (before) and C (after).
    expect(legalAttacks(state, "A").map((c) => c.id)).toContain(cardId(9, "clubs"));
    expect(legalAttacks(state, "C").map((c) => c.id)).toContain(cardId(9, "diamonds"));
    expect(legalAttacks(state, "D")).toHaveLength(0);
  });
});
