import { describe, expect, it } from "vitest";
import { canTransfer, legalDefenses, legalTransfers } from "@durak/game-core";
import { createBeatTransferDebugState } from "./debugScenarios";

describe("createBeatTransferDebugState", () => {
  it("sets up human defender with beat and transfer options", () => {
    const state = createBeatTransferDebugState();
    expect(state.defenderId).toBe("you");
    expect(state.rules.variant).toBe("perevodnoy");
    expect(canTransfer(state, "you")).toBe(true);
    expect(legalTransfers(state, 0).length).toBeGreaterThan(0);
    expect(legalDefenses(state, 0).length).toBeGreaterThan(0);
  });
});
