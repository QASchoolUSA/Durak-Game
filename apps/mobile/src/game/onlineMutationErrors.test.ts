import { describe, expect, it } from "vitest";
import { formatOnlineMutationError } from "./onlineMutationErrors";

describe("formatOnlineMutationError", () => {
  it("maps not your turn errors", () => {
    expect(formatOnlineMutationError(new Error("Move player mismatch"))).toBe(
      "It is not your turn.",
    );
  });

  it("maps illegal move errors", () => {
    expect(formatOnlineMutationError("Illegal move for current state")).toBe(
      "That move is not allowed right now.",
    );
  });

  it("passes through unknown errors", () => {
    expect(formatOnlineMutationError(new Error("Network timeout"))).toBe("Network timeout");
  });
});
