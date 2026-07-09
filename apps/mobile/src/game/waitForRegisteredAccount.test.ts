import { describe, expect, it, vi } from "vitest";
import { waitForRegisteredAccount } from "./waitForRegisteredAccount";

describe("waitForRegisteredAccount", () => {
  it("resolves immediately when already registered", async () => {
    const fetchStatus = vi.fn().mockResolvedValue({
      isAnonymous: false,
      email: "user@example.com",
    });

    const result = await waitForRegisteredAccount(fetchStatus, {
      sleep: vi.fn(),
    });

    expect(result).toEqual({ isAnonymous: false, email: "user@example.com" });
    expect(fetchStatus).toHaveBeenCalledTimes(1);
  });

  it("polls until registered", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({ isAnonymous: true, email: null })
      .mockResolvedValueOnce({ isAnonymous: true, email: null })
      .mockResolvedValueOnce({ isAnonymous: false, email: "user@example.com" });

    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await waitForRegisteredAccount(fetchStatus, {
      intervalMs: 10,
      timeoutMs: 500,
      sleep,
    });

    expect(result).toEqual({ isAnonymous: false, email: "user@example.com" });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("returns last snapshot on timeout", async () => {
    const fetchStatus = vi.fn().mockResolvedValue({
      isAnonymous: true,
      email: null,
    });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await waitForRegisteredAccount(fetchStatus, {
      intervalMs: 10,
      timeoutMs: 35,
      sleep,
    });

    expect(result).toEqual({ isAnonymous: true, email: null });
    expect(fetchStatus.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps polling through transient fetch errors", async () => {
    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ isAnonymous: false, email: "ok@example.com" });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await waitForRegisteredAccount(fetchStatus, {
      intervalMs: 10,
      timeoutMs: 500,
      sleep,
    });

    expect(result).toEqual({ isAnonymous: false, email: "ok@example.com" });
  });
});
