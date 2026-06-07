import { describe, expect, it } from "vitest";
import { applyMove } from "@durak/game-core";
import { getDevScenario } from "./debugScenarios";

describe("debugScenarios", () => {
  it("nearGameEndWin reaches gameOver after attack and take", () => {
    const { game } = getDevScenario("nearGameEndWin").build();
    expect(game.phase).toBe("playing");
    expect(game.deck).toHaveLength(0);

    const humanCard = game.hands.you![0]!;
    const afterAttack = applyMove(game, {
      type: "ATTACK",
      player: "you",
      card: humanCard,
    });
    expect(afterAttack.phase).toBe("playing");
    expect(afterAttack.table).toHaveLength(1);

    const afterTake = applyMove(afterAttack, {
      type: "TAKE",
      player: "bot1",
    });
    expect(afterTake.phase).toBe("gameOver");
    expect(afterTake.loserId).toBe("bot1");
    expect(afterTake.finishedOrder).toContain("you");
  });
});
