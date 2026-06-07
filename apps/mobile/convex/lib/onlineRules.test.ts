import { describe, expect, it } from "vitest";
import { onlineRules } from "./onlineRules";

describe("onlineRules", () => {
  it("passes playStyle from room config", () => {
    const rules = onlineRules({
      variant: "perevodnoy",
      throwInScope: "neighbor",
      playStyle: "abilities",
    });
    expect(rules.playStyle).toBe("abilities");
    expect(rules.variant).toBe("perevodnoy");
    expect(rules.throwInScope).toBe("neighbor");
  });

  it("keeps standard playStyle when configured", () => {
    const rules = onlineRules({
      variant: "podkidnoy",
      throwInScope: "all",
      playStyle: "standard",
    });
    expect(rules.playStyle).toBe("standard");
  });
});
