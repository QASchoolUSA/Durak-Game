import { describe, expect, it } from "vitest";
import {
  applyMove,
  beats,
  buildDeck,
  cardId,
  createGame,
  DEFAULT_RULES,
  forceForfeitEnd,
  isGameOver,
  legalAttacks,
  mulberry32,
  pickMove,
  shuffle,
} from "../src/index";
import type { Card, GameState, Rank, Suit } from "../src/index";

function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

function countAllCards(s: GameState): number {
  let n = s.deck.length + s.discard.length;
  for (const p of s.players) n += (s.hands[p] ?? []).length;
  for (const pair of s.table) n += 1 + (pair.defense ? 1 : 0);
  return n;
}

/** Minimal hand-built state for deterministic rule tests. */
function baseState(partial: Partial<GameState>): GameState {
  return {
    players: ["A", "B"],
    hands: { A: [], B: [] },
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

describe("deck", () => {
  it("builds 36 unique cards", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(36);
    expect(new Set(deck.map((c) => c.id)).size).toBe(36);
  });

  it("shuffles deterministically for a given seed and preserves the multiset", () => {
    const a = shuffle(buildDeck(), mulberry32(123));
    const b = shuffle(buildDeck(), mulberry32(123));
    const c = shuffle(buildDeck(), mulberry32(999));
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(36);
  });
});

describe("beats", () => {
  it("higher rank of same suit wins", () => {
    expect(beats(makeCard(10, "hearts"), makeCard(7, "hearts"), "spades")).toBe(true);
    expect(beats(makeCard(7, "hearts"), makeCard(10, "hearts"), "spades")).toBe(false);
  });
  it("trump beats non-trump", () => {
    expect(beats(makeCard(6, "spades"), makeCard(14, "hearts"), "spades")).toBe(true);
  });
  it("non-trump cannot beat trump", () => {
    expect(beats(makeCard(14, "hearts"), makeCard(6, "spades"), "spades")).toBe(false);
  });
  it("higher trump beats lower trump", () => {
    expect(beats(makeCard(9, "spades"), makeCard(7, "spades"), "spades")).toBe(true);
  });
  it("different non-trump suits never beat", () => {
    expect(beats(makeCard(14, "hearts"), makeCard(6, "clubs"), "spades")).toBe(false);
  });
});

describe("createGame", () => {
  it("deals 6 cards each and fixes the trump", () => {
    const g = createGame(["A", "B", "C"], { seed: 42 });
    expect(g.players).toHaveLength(3);
    for (const p of g.players) expect(g.hands[p]).toHaveLength(6);
    expect(g.deck.length).toBe(36 - 18);
    expect(g.trumpCard.suit).toBe(g.trumpSuit);
    expect(countAllCards(g)).toBe(36);
  });

  it("rejects fewer than 2 or more than 6 players", () => {
    expect(() => createGame(["A"], { seed: 1 })).toThrow();
    expect(() => createGame(["A", "B", "C", "D", "E", "F", "G"], { seed: 1 })).toThrow();
  });

  it("deals 6 cards each with an empty deck for 6 players", () => {
    const g = createGame(["A", "B", "C", "D", "E", "F"], { seed: 42 });
    expect(g.players).toHaveLength(6);
    for (const p of g.players) expect(g.hands[p]).toHaveLength(6);
    expect(g.deck).toHaveLength(0);
    expect(countAllCards(g)).toBe(36);
  });

  it("first attacker holds the lowest trump when one exists", () => {
    const g = createGame(["A", "B", "C", "D"], { seed: 7 });
    let lowest = Infinity;
    let owner = "";
    for (const p of g.players) {
      for (const c of g.hands[p]!) {
        if (c.suit === g.trumpSuit && c.rank < lowest) {
          lowest = c.rank;
          owner = p;
        }
      }
    }
    if (owner) expect(g.attackerId).toBe(owner);
  });

  it("starts first bout with a 5-card attack cap", () => {
    const g = createGame(["A", "B"], { seed: 42 });
    expect(g.maxAttacks).toBe(5);
  });
});

describe("attack / throw-in limits", () => {
  it("only the attacker can open, with any card", () => {
    const s = baseState({
      hands: { A: [makeCard(6, "hearts"), makeCard(9, "clubs")], B: [makeCard(10, "hearts")] },
    });
    expect(legalAttacks(s, "A")).toHaveLength(2);
    expect(legalAttacks(s, "B")).toHaveLength(0);
  });

  it("throw-ins must match a rank already on the table", () => {
    const s = baseState({
      players: ["A", "B", "C"],
      hands: {
        A: [makeCard(9, "clubs"), makeCard(7, "diamonds")],
        B: [makeCard(10, "hearts"), makeCard(13, "spades")],
        C: [],
      },
      defenderId: "B",
      attackerId: "A",
      table: [{ attack: makeCard(9, "hearts") }],
    });
    const legal = legalAttacks(s, "A").map((c) => c.id);
    expect(legal).toContain(cardId(9, "clubs"));
    expect(legal).not.toContain(cardId(7, "diamonds"));
  });

  it("cannot pile more undefended attacks than the defender can answer", () => {
    const s = baseState({
      hands: {
        A: [makeCard(9, "clubs"), makeCard(9, "diamonds")],
        B: [makeCard(10, "hearts")],
      },
      table: [{ attack: makeCard(9, "hearts") }],
    });
    // Defender holds only 1 card and already has 1 undefended attack to answer.
    expect(legalAttacks(s, "A")).toHaveLength(0);
  });

  it("caps throw-ins during take by defender hand size", () => {
    let s = baseState({
      hands: {
        A: [makeCard(9, "clubs"), makeCard(9, "diamonds")],
        B: [makeCard(8, "hearts"), makeCard(10, "hearts"), makeCard(11, "hearts")],
      },
      table: [{ attack: makeCard(9, "hearts") }],
      takeInProgress: true,
    });
    expect(legalAttacks(s, "A")).toHaveLength(2);
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "clubs") });
    expect(legalAttacks(s, "A")).toHaveLength(1);
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "diamonds") });
    expect(legalAttacks(s, "A")).toHaveLength(0);
    expect(s.table).toHaveLength(3);
  });

  it("rejects throw-in past defender hand size during take", () => {
    const s = baseState({
      hands: {
        A: [makeCard(9, "clubs")],
        B: [makeCard(8, "hearts"), makeCard(10, "hearts"), makeCard(11, "hearts")],
      },
      table: [
        { attack: makeCard(9, "hearts") },
        { attack: makeCard(9, "diamonds") },
        { attack: makeCard(9, "spades") },
      ],
      takeInProgress: true,
    });
    expect(() =>
      applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "clubs") }),
    ).toThrow();
  });

  it("blocks a 6th throw-in during the first bout", () => {
    const s = baseState({
      maxAttacks: 5,
      hands: {
        A: [makeCard(10, "clubs")],
        B: [
          makeCard(11, "hearts"),
          makeCard(12, "hearts"),
          makeCard(13, "hearts"),
          makeCard(14, "hearts"),
          makeCard(6, "spades"),
          makeCard(7, "spades"),
        ],
      },
      table: [
        { attack: makeCard(10, "hearts") },
        { attack: makeCard(9, "hearts") },
        { attack: makeCard(9, "diamonds") },
        { attack: makeCard(9, "spades") },
        { attack: makeCard(9, "clubs") },
      ],
    });
    expect(legalAttacks(s, "A")).toHaveLength(0);
  });

  it("allows a 6th throw-in after the first bout", () => {
    const s = baseState({
      maxAttacks: 6,
      hands: {
        A: [makeCard(10, "clubs")],
        B: [
          makeCard(11, "hearts"),
          makeCard(12, "hearts"),
          makeCard(13, "hearts"),
          makeCard(14, "hearts"),
          makeCard(6, "spades"),
          makeCard(7, "spades"),
        ],
      },
      table: [
        { attack: makeCard(10, "hearts") },
        { attack: makeCard(9, "hearts") },
        { attack: makeCard(9, "diamonds") },
        { attack: makeCard(9, "spades") },
        { attack: makeCard(9, "clubs") },
      ],
    });
    expect(legalAttacks(s, "A")).toHaveLength(1);
  });
});

describe("round resolution", () => {
  it("successful defense sends cards to the discard and swaps roles", () => {
    let s = baseState({
      maxAttacks: 5,
      // Spare cards so neither player empties out and ends the game.
      hands: {
        A: [makeCard(9, "hearts"), makeCard(6, "diamonds")],
        B: [makeCard(10, "hearts"), makeCard(6, "spades")],
      },
      deck: [makeCard(6, "clubs"), makeCard(7, "clubs"), makeCard(8, "clubs")],
    });
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "hearts") });
    s = applyMove(s, { type: "DEFEND", player: "B", card: makeCard(10, "hearts"), target: 0 });
    s = applyMove(s, { type: "PASS", player: "A" });
    expect(s.discard).toHaveLength(2);
    expect(s.table).toHaveLength(0);
    expect(s.maxAttacks).toBe(6);
    // Defender (B) successfully defended, so B now attacks.
    expect(s.attackerId).toBe("B");
    expect(s.defenderId).toBe("A");
    expect(countAllCards(s)).toBe(7); // cards are conserved (2 + 2 + 3 dealt)
  });

  it("taking moves all table cards into the defender's hand and skips them", () => {
    let s = baseState({
      players: ["A", "B", "C"],
      hands: {
        A: [makeCard(9, "hearts")],
        B: [makeCard(6, "clubs")],
        C: [makeCard(8, "diamonds")],
      },
      attackerId: "A",
      defenderId: "B",
      // Enough deck so players redraw and nobody is eliminated this round.
      deck: [
        makeCard(6, "spades"),
        makeCard(7, "spades"),
        makeCard(8, "spades"),
        makeCard(9, "spades"),
        makeCard(10, "spades"),
        makeCard(11, "spades"),
        makeCard(12, "spades"),
        makeCard(13, "spades"),
        makeCard(14, "spades"),
      ],
    });
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "hearts") });
    s = applyMove(s, { type: "TAKE", player: "B" });
    s = applyMove(s, { type: "PASS", player: "C" });
    expect(s.hands["B"]!.map((c) => c.id)).toContain(cardId(9, "hearts"));
    // After B takes, the attack passes to C; A becomes the next defender.
    expect(s.attackerId).toBe("C");
    expect(s.defenderId).toBe("A");
  });
});

describe("draw-up", () => {
  it("refills the attacker first and the defender last", () => {
    let s = baseState({
      players: ["A", "B"],
      // Spare cards so the game keeps going; only one card left to draw -> attacker first.
      hands: {
        A: [makeCard(9, "hearts"), makeCard(6, "diamonds")],
        B: [makeCard(10, "hearts"), makeCard(6, "spades")],
      },
      deck: [makeCard(6, "clubs")],
    });
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "hearts") });
    s = applyMove(s, { type: "DEFEND", player: "B", card: makeCard(10, "hearts"), target: 0 });
    s = applyMove(s, { type: "PASS", player: "A" });
    // The single remaining card goes to the attacker (A), who refills first.
    expect(s.hands["A"]!.map((c) => c.id)).toContain(cardId(6, "clubs"));
    expect(s.deck).toHaveLength(0);
  });
});

describe("illegal moves throw", () => {
  it("rejects defending with a card that does not beat the attack", () => {
    const s = applyMove(
      baseState({ hands: { A: [makeCard(9, "hearts")], B: [makeCard(7, "hearts")] } }),
      { type: "ATTACK", player: "A", card: makeCard(9, "hearts") },
    );
    expect(() =>
      applyMove(s, { type: "DEFEND", player: "B", card: makeCard(7, "hearts"), target: 0 }),
    ).toThrow();
  });

  it("rejects a non-defender trying to defend", () => {
    const s = applyMove(
      baseState({ hands: { A: [makeCard(9, "hearts")], B: [makeCard(10, "hearts")] } }),
      { type: "ATTACK", player: "A", card: makeCard(9, "hearts") },
    );
    expect(() =>
      applyMove(s, { type: "DEFEND", player: "A", card: makeCard(9, "hearts"), target: 0 }),
    ).toThrow();
  });
});

describe("game over", () => {
  it("ends with a draw when both players empty their hands on an empty deck", () => {
    let s = baseState({
      hands: { A: [makeCard(9, "hearts")], B: [makeCard(10, "hearts")] },
      deck: [],
    });
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "hearts") });
    s = applyMove(s, { type: "DEFEND", player: "B", card: makeCard(10, "hearts"), target: 0 });
    expect(isGameOver(s)).toBe(true);
    expect(s.loserId).toBeNull();
    expect(s.finishedOrder).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("ends with a loser when only one player still holds cards", () => {
    let s = baseState({
      hands: { A: [makeCard(9, "hearts")], B: [makeCard(7, "hearts"), makeCard(8, "clubs")] },
      deck: [],
    });
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "hearts") });
    s = applyMove(s, { type: "TAKE", player: "B" });
    expect(isGameOver(s)).toBe(true);
    expect(s.loserId).toBe("B");
    expect(s.hands["B"]!.length).toBeGreaterThan(0);
    expect(s.finishedOrder).toContain("A");
  });

  it("resolves when only the defender still has cards and the table is clear", () => {
    let s = baseState({
      players: ["A", "B", "C"],
      hands: { A: [], B: [], C: [makeCard(8, "clubs")] },
      deck: [],
      attackerId: "A",
      defenderId: "C",
      finishedOrder: ["A", "B"],
      table: [{ attack: makeCard(6, "diamonds") }],
    });
    s = applyMove(s, { type: "TAKE", player: "C" });
    expect(isGameOver(s)).toBe(true);
    expect(s.loserId).toBe("C");
  });

  it("detects game over immediately after the last card is played on an empty deck", () => {
    let s = baseState({
      hands: { A: [makeCard(6, "hearts")], B: [makeCard(7, "hearts")] },
      deck: [],
    });
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(6, "hearts") });
    s = applyMove(s, { type: "DEFEND", player: "B", card: makeCard(7, "hearts"), target: 0 });
    expect(s.phase).toBe("gameOver");
  });

  it("ends with durak when only one holder remains mid-bout", () => {
    let s = baseState({
      players: ["A", "B", "C"],
      hands: { A: [], B: [], C: [makeCard(9, "hearts"), makeCard(8, "clubs")] },
      deck: [],
      attackerId: "C",
      defenderId: "A",
      finishedOrder: ["A", "B"],
      table: [],
    });
    s = applyMove(s, { type: "ATTACK", player: "C", card: makeCard(9, "hearts") });
    expect(isGameOver(s)).toBe(true);
    expect(s.loserId).toBe("C");
    expect(s.table).toHaveLength(0);
    expect(s.hands["C"]!.map((c) => c.id)).toContain(cardId(8, "clubs"));
  });

  it("ends with draw when all players are empty mid-bout", () => {
    let s = baseState({
      hands: { A: [makeCard(9, "hearts")], B: [] },
      deck: [],
      attackerId: "A",
      defenderId: "B",
      finishedOrder: ["B"],
    });
    s = applyMove(s, { type: "ATTACK", player: "A", card: makeCard(9, "hearts") });
    expect(isGameOver(s)).toBe(true);
    expect(s.loserId).toBeNull();
    expect(s.table).toHaveLength(0);
    expect(s.discard.map((c) => c.id)).toContain(cardId(9, "hearts"));
  });
});

describe("forceForfeitEnd", () => {
  it("ends a 2-player game with the forfeiter as durak", () => {
    const s = baseState({
      hands: {
        A: [makeCard(9, "hearts")],
        B: [makeCard(7, "hearts"), makeCard(8, "clubs")],
      },
      deck: [makeCard(10, "spades")],
    });

    const ended = forceForfeitEnd(s, "B");

    expect(ended.phase).toBe("gameOver");
    expect(ended.loserId).toBe("B");
    expect(ended.finishedOrder).toEqual(["A"]);
    expect(ended.table).toHaveLength(0);
    expect(ended.takeInProgress).toBe(false);
  });

  it("keeps already-finished players ahead in finishedOrder", () => {
    const s = baseState({
      players: ["A", "B", "C"],
      hands: {
        A: [],
        B: [makeCard(9, "hearts")],
        C: [makeCard(7, "hearts")],
      },
      deck: [],
      finishedOrder: ["A"],
      attackerId: "B",
      defenderId: "C",
    });

    const ended = forceForfeitEnd(s, "C");

    expect(ended.loserId).toBe("C");
    expect(ended.finishedOrder).toEqual(["A", "B"]);
  });

  it("throws when the game is already over", () => {
    const s = baseState({ phase: "gameOver", loserId: "B" });
    expect(() => forceForfeitEnd(s, "A")).toThrow("Game already over");
  });

  it("throws when the forfeiter is not in the game", () => {
    const s = baseState();
    expect(() => forceForfeitEnd(s, "Z")).toThrow("Player not in game");
  });
});

describe("full seeded games via AI", () => {
  for (const players of [
    ["A", "B"],
    ["A", "B", "C"],
    ["A", "B", "C", "D"],
    ["A", "B", "C", "D", "E"],
    ["A", "B", "C", "D", "E", "F"],
  ]) {
    it(`plays a ${players.length}-player game to completion and conserves cards`, () => {
      let s = createGame(players, { seed: players.length * 100 + 1 });
      let steps = 0;
      while (!isGameOver(s) && steps < 5000) {
        let acted = false;
        for (const p of s.players) {
          const move = pickMove(s, p);
          if (move) {
            s = applyMove(s, move);
            acted = true;
            break;
          }
        }
        expect(countAllCards(s)).toBe(36);
        if (!acted) break; // safety: no one can move (should not happen)
        steps++;
      }
      expect(isGameOver(s)).toBe(true);
      // Exactly one durak, or a draw (both emptied together).
      if (s.loserId !== null) {
        expect(s.players).toContain(s.loserId);
        expect(s.hands[s.loserId]!.length).toBeGreaterThan(0);
      }
    });
  }
});
