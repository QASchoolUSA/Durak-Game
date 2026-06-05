import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "durak:onlineSession";

export interface StoredOnlineSession {
  roomId: string;
  displayName: string;
}

export async function saveRoomSession(session: StoredOnlineSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadRoomSession(): Promise<StoredOnlineSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOnlineSession & { sessionToken?: string };
    if (!parsed.roomId || !parsed.displayName) return null;
    return { roomId: parsed.roomId, displayName: parsed.displayName };
  } catch {
    return null;
  }
}

export async function clearRoomSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
