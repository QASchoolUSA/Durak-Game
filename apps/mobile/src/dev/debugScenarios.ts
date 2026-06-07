import {
  type Card,
  type GameState,
  type PlayerId,
  type Rank,
  type Suit,
  cardId,
  DEFAULT_RULES,
} from "@durak/game-core";

export type DevScenarioId = "nearGameEndWin";

export interface DevScenarioBuildResult {
  game: GameState;
  numPlayers: number;
  names: Record<PlayerId, string>;
}

export interface DevScenario {
  id: DevScenarioId;
  title: string;
  description: string;
  build: () => DevScenarioBuildResult;
}

const HUMAN_ID: PlayerId = "you";
const BOT_ID: PlayerId = "bot1";

function card(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

function buildNearGameEndWin(): DevScenarioBuildResult {
  const trumpCard = card(6, "spades");
  const humanCard = card(10, "hearts");

  const game: GameState = {
    players: [HUMAN_ID, BOT_ID],
    hands: {
      [HUMAN_ID]: [humanCard],
      [BOT_ID]: [card(6, "diamonds"), card(7, "diamonds"), card(8, "diamonds")],
    },
    deck: [],
    trumpSuit: "spades",
    trumpCard,
    table: [],
    discard: [],
    attackerId: HUMAN_ID,
    defenderId: BOT_ID,
    takeInProgress: false,
    passed: [],
    finishedOrder: [],
    loserId: null,
    phase: "playing",
    maxAttacks: 6,
    rules: DEFAULT_RULES,
  };

  return {
    game,
    numPlayers: 2,
    names: { [HUMAN_ID]: "You", [BOT_ID]: "Olga" },
  };
}

export const DEBUG_SCENARIOS: DevScenario[] = [
  {
    id: "nearGameEndWin",
    title: "Near game end (win)",
    description:
      "You have one card, bot cannot beat it. Attack → bot takes → game ends (tests result delay).",
    build: buildNearGameEndWin,
  },
];

export function getDevScenario(id: DevScenarioId): DevScenario {
  const scenario = DEBUG_SCENARIOS.find((s) => s.id === id);
  if (!scenario) {
    throw new Error(`Unknown dev scenario: ${id}`);
  }
  return scenario;
}
