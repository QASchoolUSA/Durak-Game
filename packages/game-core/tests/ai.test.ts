import { describe, expect, it } from "vitest";
import {
  cardId,
  createGame,
  DEFAULT_RULES,
  evaluatePosition,
  pickMove,
  type Card,
  type GameState,
  type PlayerId,
  type Rank,
  type Suit,
} from "../src";

function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

function gameWithSeed(seed: number, players: PlayerId[] = ["you", "bot1"]): GameState {
  return createGame(players, {
    seed,
    rules: { variant: "podkidnoy", throwInScope: "all", playStyle: "standard" },
  });
}

function movesEqual(a: ReturnType<typeof pickMove>, b: ReturnType<typeof pickMove>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function baseState(partial: Partial<GameState>): GameState {
  return {
    players: ["you", "bot1"],
    hands: { you: [], bot1: [] },
    deck: [makeCard(8, "hearts"), makeCard(9, "hearts"), makeCard(10, "hearts")],
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

describe("pickMove difficulty profiles", () => {
  it("defaults to medium when difficulty omitted", () => {
    const state = gameWithSeed(42);
    const bot = state.players.find((p) => p !== "you")!;
    expect(pickMove(state, bot)).toEqual(pickMove(state, bot, "medium"));
  });

  it("easy and hard differ from each other on at least one seeded position", () => {
    let found = false;
    for (let seed = 1; seed < 4000; seed++) {
      const state = gameWithSeed(seed, ["you", "bot1", "bot2"]);
      if (state.phase !== "playing") continue;

      for (const bot of state.players.filter((p) => p !== "you")) {
        const easy = pickMove(state, bot, "easy");
        const hard = pickMove(state, bot, "hard");
        if (easy && hard && !movesEqual(easy, hard)) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });

  it("returns null for players with nothing to do", () => {
    const state = gameWithSeed(7);
    const idle = state.players.find((p) => pickMove(state, p, "medium") === null);
    expect(idle).toBeDefined();
  });
});

describe("hard AI scenario choices", () => {
  it("prefers a low non-trump open over a high non-trump", () => {
    const low = makeCard(6, "clubs");
    const high = makeCard(14, "hearts");
    const trumpSpare = makeCard(7, "spades");
    const state = baseState({
      attackerId: "bot1",
      defenderId: "you",
      hands: {
        bot1: [low, high, trumpSpare],
        you: [makeCard(8, "clubs"), makeCard(9, "diamonds"), makeCard(10, "diamonds")],
      },
      table: [],
    });

    const move = pickMove(state, "bot1", "hard");
    expect(move).toEqual({ type: "ATTACK", player: "bot1", card: low });
  });

  it("defends the cheapest beat across multiple undefended targets", () => {
    const attackLow = makeCard(6, "clubs");
    const attackHigh = makeCard(10, "hearts");
    const cheapBeat = makeCard(7, "clubs");
    const expensiveBeat = makeCard(14, "spades"); // trump ace
    const state = baseState({
      attackerId: "bot1",
      defenderId: "you",
      hands: {
        bot1: [makeCard(8, "diamonds")],
        you: [cheapBeat, expensiveBeat, makeCard(9, "diamonds")],
      },
      table: [{ attack: attackLow }, { attack: attackHigh }],
    });

    // Only the clubs 7 can beat clubs 6 cheaply; hearts 10 needs trump.
    // Hard should cover the cheap target first, not blindly table[0] with a worse path.
    const move = pickMove(state, "you", "hard");
    expect(move).toMatchObject({
      type: "DEFEND",
      player: "you",
      card: cheapBeat,
      target: 0,
    });
  });

  it("throws in a low matching rank while the defender is taking", () => {
    const dump = makeCard(6, "diamonds");
    const keepTrump = makeCard(12, "spades");
    const state = baseState({
      attackerId: "bot1",
      defenderId: "you",
      takeInProgress: true,
      // Defender must hold more cards than undefended attacks to allow throw-ins.
      hands: {
        bot1: [dump, keepTrump, makeCard(8, "hearts")],
        you: [makeCard(9, "clubs"), makeCard(10, "clubs")],
      },
      table: [{ attack: makeCard(6, "clubs") }],
    });

    const move = pickMove(state, "bot1", "hard");
    expect(move).toEqual({ type: "ATTACK", player: "bot1", card: dump });
  });

  it("scores finished players higher than the loser", () => {
    const playing = baseState({
      hands: {
        you: [makeCard(7, "clubs")],
        bot1: [makeCard(8, "clubs"), makeCard(9, "clubs")],
      },
    });
    const over: GameState = {
      ...playing,
      phase: "gameOver",
      finishedOrder: ["bot1"],
      loserId: "you",
      hands: { you: [makeCard(7, "clubs")], bot1: [] },
      deck: [],
    };
    expect(evaluatePosition(over, "bot1")).toBeGreaterThan(evaluatePosition(over, "you"));
  });
});
