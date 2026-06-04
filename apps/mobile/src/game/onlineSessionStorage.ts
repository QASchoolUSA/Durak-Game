import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "durak:onlineSession";

export interface StoredOnlineSession {
  roomId: string;
  sessionToken: string;
  displayName: string;
}

export async function saveRoomSession(session: StoredOnlineSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadRoomSession(): Promise<StoredOnlineSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredOnlineSession;
  } catch {
    return null;
  }
}

export async function clearRoomSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
