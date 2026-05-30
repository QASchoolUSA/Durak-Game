import { describe, expect, it } from "vitest";
import {
  applyMove,
  cardId,
  DEFAULT_RULES,
  legalAttacks,
  legalDefenses,
  undefendedPairs,
} from "../src/index";
import type { Card, GameState, PlayerId, Rank, Suit } from "../src/index";

function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

function baseState(partial: Partial<GameState>): GameState {
  return {
    players: ["you", "bot1"],
    hands: { you: [], bot1: [] },
    deck: [],
    trumpSuit: "spades",
    trumpCard: makeCard(6, "spades"),
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
    rules: DEFAULT_RULES,
    ...partial,
  };
}

// Mirror of the app's getHumanView defendable computation.
function defendableMap(state: GameState, human: PlayerId): Record<string, number[]> {
  const defendable: Record<string, number[]> = {};
  if (state.defenderId === human && !state.takeInProgress) {
    for (const target of undefendedPairs(state)) {
      for (const card of legalDefenses(state, target)) {
        (defendable[card.id] ??= []).push(target);
      }
    }
  }
  return defendable;
}

describe("trump-only defense", () => {
  it("offers the trump as a defender and applies the DEFEND move", () => {
    // Attack is a non-trump 10 of hearts. Defender's only beater is a trump 6 of spades.
    const attack = makeCard(10, "hearts");
    const trump = makeCard(6, "spades");
    const useless = makeCard(7, "clubs"); // wrong suit, lower, not trump

    const state = baseState({
      hands: { you: [trump, useless], bot1: [makeCard(9, "clubs"), makeCard(14, "diamonds")] },
      table: [{ attack }],
    });

    // Attacker (defender) shouldn't be able to attack.
    expect(legalAttacks(state, "you")).toHaveLength(0);

    const defendable = defendableMap(state, "you");
    expect(defendable[trump.id]).toEqual([0]);
    expect(defendable[useless.id]).toBeUndefined();

    const next = applyMove(state, {
      type: "DEFEND",
      player: "you",
      card: trump,
      target: defendable[trump.id]![0]!,
    });
    expect(next.table[0]!.defense?.id).toBe(trump.id);
  });
});
