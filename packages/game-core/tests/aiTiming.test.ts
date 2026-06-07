import { describe, expect, it } from "vitest";
import { AI_DELAY_MS, aiMoveDelayMs, MIN_AI_DELAY_MS } from "../src/aiTiming";

describe("aiMoveDelayMs", () => {
  it("returns at least MIN_AI_DELAY_MS for every difficulty", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      expect(aiMoveDelayMs(difficulty)).toBeGreaterThanOrEqual(MIN_AI_DELAY_MS);
      expect(aiMoveDelayMs(difficulty)).toBe(AI_DELAY_MS[difficulty]);
    }
  });
});
