import { describe, expect, it } from "vitest";
import {
  DEFAULT_TURN_SECONDS,
  normalizeTurnSeconds,
  VALID_TURN_SECONDS,
} from "../src/turnTimer";

describe("normalizeTurnSeconds", () => {
  it("accepts valid options", () => {
    for (const s of VALID_TURN_SECONDS) {
      expect(normalizeTurnSeconds(s)).toBe(s);
    }
  });

  it("migrates legacy off and 60 to default", () => {
    expect(normalizeTurnSeconds(0)).toBe(DEFAULT_TURN_SECONDS);
    expect(normalizeTurnSeconds(60)).toBe(DEFAULT_TURN_SECONDS);
    expect(normalizeTurnSeconds(null)).toBe(DEFAULT_TURN_SECONDS);
    expect(normalizeTurnSeconds(99)).toBe(DEFAULT_TURN_SECONDS);
  });
});
