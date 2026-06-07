import { describe, expect, it } from "vitest";
import {
  applyMove,
  cloneGameState,
  createGame,
  type Move,
} from "@durak/game-core";
import { timeoutMoveFor } from "./onlineGame";

describe("online game flow helpers", () => {
  it("applies a valid attack and defend sequence", () => {
    let state = createGame(["p0", "p1"], { seed: 99 });
    const attacker = state.attackerId;
    const defender = state.defenderId;
    const card = state.hands[attacker]![0]!;

    state = applyMove(state, { type: "ATTACK", player: attacker, card });
    expect(state.table).toHaveLength(1);

    const defenseCard = state.hands[defender]!.find(
      (c) => c.suit === card.suit || c.suit === state.trumpSuit,
    );
    expect(defenseCard).toBeDefined();

    state = applyMove(state, {
      type: "DEFEND",
      player: defender,
      card: defenseCard!,
      target: 0,
    });
    expect(state.table[0]?.defense).toBeDefined();
  });

  it("rejects an illegal move", () => {
    const state = createGame(["p0", "p1"], { seed: 7 });
    const wrongPlayer = state.defenderId;
    const card = state.hands[state.attackerId]![0]!;

    expect(() =>
      applyMove(state, { type: "ATTACK", player: wrongPlayer, card }),
    ).toThrow();
  });

  it("restores a pre-move snapshot for return window", () => {
    const state = createGame(["p0", "p1"], { seed: 11 });
    const attacker = state.attackerId;
    const snapshot = cloneGameState(state);
    const card = state.hands[attacker]![0]!;

    const after = applyMove(state, { type: "ATTACK", player: attacker, card });
    expect(after.table).toHaveLength(1);

    const restored = snapshot;
    expect(restored.table).toHaveLength(0);
    expect(restored.hands[attacker]).toHaveLength(state.hands[attacker]!.length);
  });

  it("produces a timeout move for the active human", () => {
    const state = createGame(["p0", "p1"], { seed: 3 });
    const human = state.attackerId;
    const move = timeoutMoveFor(state, human);
    expect(move).not.toBeNull();
    expect((move as Move).player).toBe(human);
  });
});
