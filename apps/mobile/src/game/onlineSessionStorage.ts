import AsyncStorage from "@react-native-async-storage/async-storage";

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
    const parsed = JSON.parse(raw) as StoredPlaySession &
      StoredOnlineSession & { sessionToken?: string };

    if (
      typeof parsed.lastActiveAt === "number" &&
      Number.isFinite(parsed.lastActiveAt)
    ) {
      const online =
        parsed.online?.roomId && parsed.online.displayName
          ? parsed.online
          : undefined;
      return { lastActiveAt: parsed.lastActiveAt, online };
    }

    // Legacy format: { roomId, displayName } without lastActiveAt — treat as expired.
    if (parsed.roomId && parsed.displayName) {
      return { lastActiveAt: 0, online: { roomId: parsed.roomId, displayName: parsed.displayName } };
    }

    return null;
  } catch {
    return null;
  }
}

export function isPlaySessionExpired(session: StoredPlaySession | null): boolean {
  if (!session) return false;
  if (!session.lastActiveAt || session.lastActiveAt <= 0) return true;
  return Date.now() - session.lastActiveAt > PLAY_SESSION_IDLE_MS;
}

export async function loadPlaySession(): Promise<StoredPlaySession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return parseSession(raw);
  } catch {
    return null;
  }
}

export async function touchPlaySession(
  online?: StoredOnlineSession,
): Promise<void> {
  const payload: StoredPlaySession = {
    lastActiveAt: Date.now(),
    ...(online ? { online } : {}),
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export async function clearPlaySession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

/** @deprecated Use touchPlaySession */
export async function saveRoomSession(session: StoredOnlineSession): Promise<void> {
  await touchPlaySession(session);
}

/** @deprecated Use loadPlaySession */
export async function loadRoomSession(): Promise<StoredOnlineSession | null> {
  const play = await loadPlaySession();
  return play?.online ?? null;
}

/** @deprecated Use clearPlaySession */
export async function clearRoomSession(): Promise<void> {
  await clearPlaySession();
}
