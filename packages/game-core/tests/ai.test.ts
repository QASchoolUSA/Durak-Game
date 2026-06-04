import { describe, expect, it } from "vitest";
import { createGame, pickMove, type GameState, type PlayerId } from "../src";

function gameWithSeed(seed: number, players: PlayerId[] = ["you", "bot1"]): GameState {
  return createGame(players, {
    seed,
    rules: { variant: "podkidnoy", throwInScope: "all", playStyle: "standard" },
  });
}

function movesEqual(a: ReturnType<typeof pickMove>, b: ReturnType<typeof pickMove>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
