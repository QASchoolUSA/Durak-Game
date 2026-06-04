import { describe, expect, it } from "vitest";
import {
  applyMove,
  canTransfer,
  cardId,
  DEFAULT_RULES,
  legalTransfers,
} from "../src/index";
import type { Card, GameState, Rank, Suit } from "../src/index";

function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

function baseState(partial: Partial<GameState>): GameState {
  return {
    players: ["A", "B", "C"],
    hands: { A: [], B: [], C: [] },
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
    rules: { variant: "perevodnoy", throwInScope: "all" },
    ...partial,
  };
}

describe("perevodnoy transfer", () => {
  it("allows transfer on the opening attack with matching rank", () => {
    const state = baseState({
      hands: {
        A: [makeCard(9, "hearts")],
        B: [makeCard(9, "diamonds"), makeCard(7, "clubs")],
        C: [makeCard(10, "hearts"), makeCard(8, "clubs")],
      },
      table: [{ attack: makeCard(9, "clubs") }],
    });
    expect(canTransfer(state, "B")).toBe(true);
    expect(legalTransfers(state, 0).map((c) => c.id)).toContain(cardId(9, "diamonds"));
  });

  it("rotates defender and adds the transfer card as a new attack", () => {
    let state = baseState({
      hands: {
        A: [makeCard(9, "hearts")],
        B: [makeCard(9, "diamonds"), makeCard(7, "clubs")],
        C: [makeCard(10, "hearts"), makeCard(8, "clubs")],
      },
      table: [{ attack: makeCard(9, "clubs") }],
    });
    state = applyMove(state, {
      type: "TRANSFER",
      player: "B",
      card: makeCard(9, "diamonds"),
      target: 0,
    });
    expect(state.defenderId).toBe("C");
    expect(state.attackerId).toBe("A");
    expect(state.table).toHaveLength(2);
    expect(state.table[1]!.attack.id).toBe(cardId(9, "diamonds"));
    expect(state.table[1]!.defense).toBeUndefined();
    expect(state.passed).toHaveLength(0);
  });

  it("allows chained transfer after the first transfer", () => {
    let state = baseState({
      hands: {
        A: [makeCard(9, "hearts"), makeCard(7, "hearts"), makeCard(8, "hearts")],
        B: [makeCard(9, "diamonds"), makeCard(7, "clubs")],
        C: [makeCard(9, "spades"), makeCard(8, "clubs")],
      },
      table: [{ attack: makeCard(9, "clubs") }],
    });
    state = applyMove(state, {
      type: "TRANSFER",
      player: "B",
      card: makeCard(9, "diamonds"),
      target: 0,
    });
    expect(state.defenderId).toBe("C");
    expect(canTransfer(state, "C")).toBe(true);
    expect(legalTransfers(state, 0).map((c) => c.id)).toContain(cardId(9, "spades"));
  });

  it("completes a three-player transfer chain", () => {
    let state = baseState({
      hands: {
        A: [makeCard(9, "hearts"), makeCard(7, "hearts"), makeCard(8, "hearts"), makeCard(10, "hearts")],
        B: [makeCard(9, "diamonds")],
        C: [makeCard(9, "spades"), makeCard(6, "diamonds")],
      },
      table: [{ attack: makeCard(9, "clubs") }],
    });
    state = applyMove(state, {
      type: "TRANSFER",
      player: "B",
      card: makeCard(9, "diamonds"),
      target: 0,
    });
    expect(canTransfer(state, "C")).toBe(true);
    state = applyMove(state, {
      type: "TRANSFER",
      player: "C",
      card: makeCard(9, "spades"),
      target: 0,
    });
    expect(state.defenderId).toBe("A");
    expect(state.table).toHaveLength(3);
    expect(state.table[1]!.viaTransfer).toBe(true);
    expect(state.table[2]!.viaTransfer).toBe(true);
  });

  it("blocks transfer after a throw-in", () => {
    const state = baseState({
      hands: {
        A: [makeCard(9, "hearts"), makeCard(9, "spades")],
        B: [makeCard(9, "diamonds")],
        C: [makeCard(10, "hearts"), makeCard(8, "clubs")],
      },
      table: [{ attack: makeCard(9, "clubs") }, { attack: makeCard(9, "hearts") }],
    });
    expect(legalTransfers(state, 0)).toHaveLength(0);
    expect(canTransfer(state, "B")).toBe(false);
  });

  it("blocks transfer when the next defender lacks capacity", () => {
    const state = baseState({
      hands: {
        A: [makeCard(9, "hearts")],
        B: [makeCard(9, "diamonds")],
        C: [makeCard(10, "hearts")],
      },
      table: [{ attack: makeCard(9, "clubs") }],
    });
    // After transfer there would be 2 undefended attacks; C only holds 1 card.
    expect(legalTransfers(state, 0)).toHaveLength(0);
  });

  it("is unavailable in podkidnoy mode", () => {
    const state = baseState({
      rules: DEFAULT_RULES,
      hands: {
        A: [makeCard(9, "hearts")],
        B: [makeCard(9, "diamonds"), makeCard(7, "clubs")],
        C: [makeCard(10, "hearts"), makeCard(8, "clubs")],
      },
      table: [{ attack: makeCard(9, "clubs") }],
    });
    expect(legalTransfers(state, 0)).toHaveLength(0);
  });
});
