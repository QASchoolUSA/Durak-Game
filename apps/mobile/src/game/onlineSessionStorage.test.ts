import { describe, expect, it, vi, afterEach } from "vitest";
import {
  PLAY_SESSION_IDLE_MS,
  isPlaySessionExpired,
  type StoredPlaySession,
} from "./onlineSessionStorage";

describe("isPlaySessionExpired", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when session is null", () => {
    expect(isPlaySessionExpired(null)).toBe(false);
  });

  it("returns true when lastActiveAt is missing or zero", () => {
    expect(isPlaySessionExpired({ lastActiveAt: 0 })).toBe(true);
  });

  it("returns false within idle window", () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const session: StoredPlaySession = {
      lastActiveAt: now - PLAY_SESSION_IDLE_MS + 1,
    };
    expect(isPlaySessionExpired(session)).toBe(false);
  });

  it("returns true after idle window", () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const session: StoredPlaySession = {
      lastActiveAt: now - PLAY_SESSION_IDLE_MS - 1,
    };
    expect(isPlaySessionExpired(session)).toBe(true);
  });
});
