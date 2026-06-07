import { describe, expect, it } from "vitest";
import { MATCH_BUY_IN } from "./creditEconomy";
import { soloMatchEndCreditDelta } from "./matchSettlement";

describe("soloMatchEndCreditDelta", () => {
  it("awards full pot to the winning human", () => {
    expect(
      soloMatchEndCreditDelta({
        isDraw: false,
        humanIsWinner: true,
        numPlayers: 2,
      }),
    ).toBe(200);
  });

  it("refunds buy-in on a draw", () => {
    expect(
      soloMatchEndCreditDelta({
        isDraw: true,
        humanIsWinner: false,
        numPlayers: 4,
      }),
    ).toBe(MATCH_BUY_IN);
  });

  it("returns 0 for a losing human (buy-in already paid)", () => {
    expect(
      soloMatchEndCreditDelta({
        isDraw: false,
        humanIsWinner: false,
        numPlayers: 3,
      }),
    ).toBe(0);
  });
});
