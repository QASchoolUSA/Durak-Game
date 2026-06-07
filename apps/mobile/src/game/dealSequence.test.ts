import { describe, expect, it } from "vitest";
import { createGame, type GameState } from "@durak/game-core";
import {
  buildDealQueue,
  dealSequenceDurationMs,
  dealTimingForMode,
  detectDealEvent,
  groupStepsIntoRounds,
  humanHandIdsBeforeDeal,
  refillDisplayedCounts,
} from "./dealSequence";

describe("dealSequence", () => {
  it("detects initial deal on fresh game", () => {
    const game = createGame(["A", "B"], { seed: 1 });
    const event = detectDealEvent(null, game);
    expect(event?.kind).toBe("initial");
    expect(event?.steps).toHaveLength(12);
    expect(event?.steps[0]?.playerId).toBe("A");
    expect(event?.steps[1]?.playerId).toBe("B");
  });

  it("builds solo and online timing presets without springs", () => {
    const game = createGame(["A", "B"], { seed: 1 });
    const event = detectDealEvent(null, game)!;
    const solo = buildDealQueue(event.steps, dealTimingForMode("solo", false));
    const online = buildDealQueue(event.steps, dealTimingForMode("online", false));
    expect(solo[0]!.delayMs).toBe(0);
    expect(online[0]!.delayMs).toBe(0);
    expect(solo[0]!.useSpring).toBe(false);
    expect(online[0]!.useSpring).toBe(false);
    expect(solo[0]!.flightMs).toBeGreaterThan(online[0]!.flightMs);
  });

  it("groups steps into rounds", () => {
    const game = createGame(["A", "B", "C"], { seed: 1 });
    const event = detectDealEvent(null, game)!;
    const rounds = groupStepsIntoRounds(event.steps, 3);
    expect(rounds).toHaveLength(6);
    expect(rounds[0]!.map((s) => s.playerId)).toEqual(["A", "B", "C"]);
  });

  it("computes sequential deal duration", () => {
    const game = createGame(["A", "B"], { seed: 1 });
    const queue = buildDealQueue(
      detectDealEvent(null, game)!.steps,
      dealTimingForMode("solo", false),
    );
    expect(dealSequenceDurationMs(queue)).toBe(queue.length * (220 + 60));
  });

  it("detects refill when deck shrinks and hands grow", () => {
    const prev = createGame(["A", "B"], { seed: 2 });
    while (prev.hands.A!.length > 1) prev.hands.A!.pop();
    while (prev.hands.B!.length > 1) prev.hands.B!.pop();
    prev.deck = prev.deck.slice(0, 2);
    prev.table = [];

    const next: GameState = structuredClone(prev);
    next.hands.A!.push(next.deck.shift()!);
    next.hands.B!.push(next.deck.shift()!);

    const event = detectDealEvent(prev, next);
    expect(event?.kind).toBe("refill");
    expect(event?.steps).toHaveLength(2);
  });

  it("refill only queues cards missing from each hand", () => {
    const prev = createGame(["human", "B"], { seed: 3 });
    prev.hands.human = prev.hands.human!.slice(0, 4);
    prev.hands.B = prev.hands.B!.slice(0, 5);
    prev.deck = prev.deck.slice(0, 3);
    prev.table = [];

    const next: GameState = structuredClone(prev);
    next.hands.human!.push(next.deck.shift()!, next.deck.shift()!);
    next.hands.B!.push(next.deck.shift()!);

    const event = detectDealEvent(prev, next);
    expect(event?.kind).toBe("refill");
    const humanSteps = event!.steps.filter((s) => s.playerId === "human");
    expect(humanSteps).toHaveLength(2);
    expect(refillDisplayedCounts(prev).human).toBe(4);
    expect(humanHandIdsBeforeDeal(prev, "human").size).toBe(4);
  });

  it("excludes taken table cards from defender refill steps after a take", () => {
    const prev = createGame(["human", "B"], { seed: 4 });
    prev.hands.human = prev.hands.human!.slice(0, 4);
    prev.hands.B = prev.hands.B!.slice(0, 5);
    prev.deck = prev.deck.slice(0, 4);
    prev.defenderId = "human";
    prev.takeInProgress = true;
    prev.table = [
      {
        attack: { id: "t-a1", suit: "hearts", rank: 6 },
        defense: { id: "t-d1", suit: "spades", rank: 10 },
      },
      {
        attack: { id: "t-a2", suit: "clubs", rank: 7 },
        defense: undefined,
      },
    ];

    const next: GameState = structuredClone(prev);
    next.takeInProgress = false;
    next.table = [];
    const taken = [prev.table[0]!.attack, prev.table[0]!.defense!, prev.table[1]!.attack];
    next.hands.human = [...prev.hands.human!, ...taken];
    next.hands.human!.push(next.deck.shift()!, next.deck.shift()!);
    next.hands.B!.push(next.deck.shift()!);

    const event = detectDealEvent(prev, next);
    expect(event?.kind).toBe("refill");
    expect(event!.steps.filter((s) => s.playerId === "human")).toHaveLength(2);
    expect(event!.steps.filter((s) => s.playerId === "B")).toHaveLength(1);
    expect(event!.steps).toHaveLength(3);
  });
});
