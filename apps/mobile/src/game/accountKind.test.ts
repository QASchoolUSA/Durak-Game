import { describe, expect, it } from "vitest";
import { resolveAccountKind } from "./accountKind";

describe("resolveAccountKind", () => {
  it("defaults to guest when status is missing", () => {
    expect(resolveAccountKind(undefined, null)).toEqual({
      isGuest: true,
      email: null,
    });
  });

  it("uses server status when no override", () => {
    expect(
      resolveAccountKind({ isAnonymous: false, email: "a@b.com" }, null),
    ).toEqual({ isGuest: false, email: "a@b.com" });
  });

  it("optimistic registered wins over stale anonymous status", () => {
    expect(
      resolveAccountKind({ isAnonymous: true, email: null }, "registered"),
    ).toEqual({ isGuest: false, email: null });
  });

  it("optimistic guest wins over stale registered status", () => {
    expect(
      resolveAccountKind({ isAnonymous: false, email: "a@b.com" }, "guest"),
    ).toEqual({ isGuest: true, email: null });
  });
});
