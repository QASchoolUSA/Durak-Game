import { cardId, type Card, type GameState, type PlayerId } from "@durak/game-core";

const HUMAN_ID: PlayerId = "you";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

/**
 * Perevodnoy: you defend a single 9♣ attack with 9♦ (transfer) and 10♣ (beat).
 * Mirrors packages/game-core/tests/transfer.test.ts opening setup.
 */
export function createBeatTransferDebugState(): GameState {
  return {
    // Order matters: seat after you must be bot2 with 2+ cards for transfer.
    players: ["bot1", HUMAN_ID, "bot2"],
    hands: {
      bot1: [c(9, "hearts")],
      [HUMAN_ID]: [c(9, "diamonds"), c(10, "clubs"), c(7, "hearts")],
      bot2: [c(10, "hearts"), c(8, "clubs")],
    },
    deck: [],
    trumpSuit: "spades",
    trumpCard: c(6, "spades"),
    table: [{ attack: c(9, "clubs") }],
    discard: [],
    attackerId: "bot1",
    defenderId: HUMAN_ID,
    takeInProgress: false,
    passed: [],
    finishedOrder: [],
    loserId: null,
    phase: "playing",
    maxAttacks: 6,
    rules: { variant: "perevodnoy", throwInScope: "all" },
  };
}

export type DebugScenario = "beatTransfer";

export const DEBUG_SCENARIO_LABEL: Record<DebugScenario, string> = {
  beatTransfer: "Beat / transfer",
};
