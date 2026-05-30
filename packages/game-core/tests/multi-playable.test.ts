import { describe, expect, it } from "vitest";
import { cardId, legalAttacks } from "../src/index";
import type { Card, GameState, Rank, Suit } from "../src/index";

function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

describe("multiple legal plays in hand", () => {
  it("allows every card matching a rank on the table", () => {
    const nineH = makeCard(9, "hearts");
    const nineD = makeCard(9, "diamonds");
    const nineS = makeCard(9, "spades");

    const state: GameState = {
      players: ["you", "bot1"],
      hands: {
        you: [nineH, nineD, nineS, makeCard(7, "clubs")],
        bot1: [makeCard(8, "clubs"), makeCard(10, "diamonds")],
      },
      deck: [],
      trumpSuit: "spades",
      trumpCard: makeCard(6, "spades"),
      table: [{ attack: makeCard(9, "clubs") }],
      discard: [],
      attackerId: "you",
      defenderId: "bot1",
      takeInProgress: false,
      passed: [],
      finishedOrder: [],
      loserId: null,
      phase: "playing",
      maxAttacks: 6,
      rules: { variant: "podkidnoy", throwInScope: "all" },
    };

    const legal = legalAttacks(state, "you");
    expect(legal.map((c) => c.id).sort()).toEqual([nineH.id, nineD.id, nineS.id].sort());
  });
});
