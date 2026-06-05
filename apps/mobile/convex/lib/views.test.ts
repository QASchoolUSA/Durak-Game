import { describe, expect, it } from "vitest";
import { createGame } from "@durak/game-core";
import { sanitizeGameState } from "./views";

describe("sanitizeGameState", () => {
  it("shows viewer hand and hides opponent cards", () => {
    const game = createGame(["you", "bot1"], { seed: 42 });
    const sanitized = sanitizeGameState(game, "you");

    expect(sanitized.hands.you?.length).toBe(game.hands.you?.length);
    expect(sanitized.hands.you?.[0]?.id).toBe(game.hands.you?.[0]?.id);
    expect(sanitized.hands.bot1?.every((c) => c.id.startsWith("hidden-"))).toBe(true);
    expect(sanitized.deck[0]?.suit).toBe(game.deck[0]?.suit);
    if (sanitized.deck.length > 1) {
      expect(sanitized.deck[1]?.id.startsWith("hidden-deck-")).toBe(true);
    }
  });
});
