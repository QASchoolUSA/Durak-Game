import { describe, expect, it } from "vitest";
import { onlineRules } from "./onlineRules";

describe("onlineRules", () => {
  it("forces standard playStyle regardless of config", () => {
    const rules = onlineRules({
      variant: "perevodnoy",
      throwInScope: "neighbor",
      playStyle: "abilities",
    });
    expect(rules.playStyle).toBe("standard");
    expect(rules.variant).toBe("perevodnoy");
    expect(rules.throwInScope).toBe("neighbor");
  });
});
