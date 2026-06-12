import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("./nativeAsyncStorage", () => ({
  getNativeStorage: async () => null,
}));

import {
  generateGuestDisplayName,
  isLegacyGuestName,
} from "./playerNameStorage";

describe("generateGuestDisplayName", () => {
  it("produces Guest### names", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateGuestDisplayName()).toMatch(/^Guest\d{3}$/);
    }
  });
});

describe("isLegacyGuestName", () => {
  it("matches old pool-generated guest names", () => {
    expect(isLegacyGuestName("Olga342")).toBe(true);
    expect(isLegacyGuestName("Ivan100")).toBe(true);
    expect(isLegacyGuestName("Sergey999")).toBe(true);
  });

  it("ignores new guest names, handles, and custom names", () => {
    expect(isLegacyGuestName("Guest123")).toBe(false);
    expect(isLegacyGuestName("ivan342")).toBe(false);
    expect(isLegacyGuestName("Ivan")).toBe(false);
    expect(isLegacyGuestName("Olga1234")).toBe(false);
    expect(isLegacyGuestName("Nikita")).toBe(false);
  });
});
