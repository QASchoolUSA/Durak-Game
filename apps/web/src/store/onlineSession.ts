const SESSION_KEY = "durak:onlineSession";
export const PLAY_SESSION_IDLE_MS = 5 * 60 * 1000;

export interface StoredOnlineSession {
  roomId: string;
  displayName: string;
}

export interface StoredPlaySession {
  lastActiveAt: number;
  online?: StoredOnlineSession;
}

function parseSession(raw: string | null): StoredPlaySession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.lastActiveAt === "number") {
      const online =
        parsed.online?.roomId && parsed.online.displayName
          ? parsed.online
          : undefined;
      return { lastActiveAt: parsed.lastActiveAt, online };
    }
    return null;
  } catch {
    return null;
  }
}

export const onlineSession = {
  isPlaySessionExpired(session: StoredPlaySession | null): boolean {
    if (!session) return false;
    if (!session.lastActiveAt || session.lastActiveAt <= 0) return true;
    return Date.now() - session.lastActiveAt > PLAY_SESSION_IDLE_MS;
  },

  loadPlaySession(): StoredPlaySession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return parseSession(raw);
    } catch {
      return null;
    }
  },

  touchPlaySession(online?: StoredOnlineSession): void {
    const payload: StoredPlaySession = {
      lastActiveAt: Date.now(),
      ...(online ? { online } : {}),
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {}
  },

  clearPlaySession(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  },
};
