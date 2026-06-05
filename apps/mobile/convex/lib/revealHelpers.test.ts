import { describe, expect, it } from "vitest";
import { createGame } from "@durak/game-core";
import { canReveal, pickRevealedCard, revealEligibleOpponents } from "./revealHelpers";

describe("revealHelpers", () => {
  it("lists opponents with more than one card", () => {
    const state = createGame(["you", "bot"], { seed: 5 });
    const opponents = revealEligibleOpponents(state, "you");
    expect(opponents).toContain("bot");
  });

  it("picks a card by sorted index when reveal is allowed", () => {
    const state = createGame(["you", "bot"], { seed: 8 });
    if (!canReveal(state, state.attackerId)) {
      return;
    }
    const human = state.attackerId;
    const opponent = revealEligibleOpponents(state, human)[0]!;
    const card = pickRevealedCard(state, human, opponent, 0);
    expect(card.id).toBeTruthy();
  });
});
