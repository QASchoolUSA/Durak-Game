import { describe, expect, it, vi } from "vitest";

vi.mock("../feedback/haptics", () => ({
  trigger: vi.fn(),
}));
import type { GameState, PlayerId } from "@durak/game-core";
import {
  anySeatOnClock,
  computeTurnRemaining,
  turnProgressFromRemaining,
} from "./turnClockEngine";

function minimalGame(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: "playing",
    players: ["you", "bot1"] as PlayerId[],
    attackerId: "you" as PlayerId,
    defenderId: "bot1" as PlayerId,
    takeInProgress: false,
    finishedOrder: [],
    table: [],
    hands: { you: [], bot1: [] },
    deck: [],
    discard: [],
    trumpSuit: "hearts",
    trumpCard: null,
    passed: [],
    rules: { variant: "podkidnoy", throwInScope: "all" },
    ...overrides,
  } as GameState;
}

describe("anySeatOnClock", () => {
  it("returns true when human must act", () => {
    const game = minimalGame();
    expect(anySeatOnClock(game, "you", true, ["bot1"])).toBe(true);
  });

  it("returns true when opponent is active and human is not acting", () => {
    const game = minimalGame({ attackerId: "bot1" as PlayerId, defenderId: "you" as PlayerId });
    expect(anySeatOnClock(game, "you", false, ["bot1"])).toBe(true);
  });

  it("returns false when no seat is on the clock", () => {
    const game = minimalGame({
      phase: "gameOver",
      attackerId: "bot1" as PlayerId,
      defenderId: "you" as PlayerId,
    });
    expect(anySeatOnClock(game, "you", false, ["bot1"])).toBe(false);
  });
});

describe("computeTurnRemaining", () => {
  it("returns total seconds when clock is disabled", () => {
    const remaining = computeTurnRemaining({
      enabled: false,
      totalSeconds: 12,
      lastMoveAt: Date.now() - 5000,
      turnDeadlineAt: null,
      playMode: "solo",
      onTimeout: () => {},
    });
    expect(remaining).toBe(12);
  });

  it("counts down from lastMoveAt in solo mode", () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const remaining = computeTurnRemaining({
      enabled: true,
      totalSeconds: 12,
      lastMoveAt: now - 3000,
      turnDeadlineAt: null,
      playMode: "solo",
      onTimeout: () => {},
    });

    expect(remaining).toBeCloseTo(9, 0);
    vi.useRealTimers();
  });

  it("uses turnDeadlineAt in online mode", () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const remaining = computeTurnRemaining({
      enabled: true,
      totalSeconds: 12,
      lastMoveAt: now - 9000,
      turnDeadlineAt: now + 4000,
      playMode: "online",
      onTimeout: () => {},
    });

    expect(remaining).toBeCloseTo(4, 0);
    vi.useRealTimers();
  });
});

describe("turnProgressFromRemaining", () => {
  it("returns 0 when timer is off", () => {
    expect(turnProgressFromRemaining(12, 0)).toBe(0);
  });

  it("maps remaining time to 0–1 progress", () => {
    expect(turnProgressFromRemaining(6, 12)).toBe(0.5);
    expect(turnProgressFromRemaining(12, 12)).toBe(1);
  });
});
