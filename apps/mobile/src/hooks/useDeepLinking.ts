import { useEffect } from "react";
import { Linking } from "react-native";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGameStore } from "../game/store";
import { saveRoomSession } from "../game/onlineSessionStorage";
import { trigger } from "../feedback/haptics";

function parseQueryParams(url: string): Record<string, string> {
  try {
    const queryPart = url.split("?")[1];
    if (!queryPart) return {};
    const params: Record<string, string> = {};
    queryPart.split("&").forEach((part) => {
      const [key, val] = part.split("=");
      if (key && val) {
        params[decodeURIComponent(key)] = decodeURIComponent(val);
      }
    });
    return params;
  } catch {
    return {};
  }
}

export function useDeepLinking() {
  const { isAuthenticated } = useConvexAuth();
  const joinRoom = useMutation(api.rooms.joinRoom);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUrl = (url: string) => {
      try {
        const queryParams = parseQueryParams(url);
        const code = queryParams.code;
        const roomId = queryParams.roomId;

        if (code && roomId) {
          const displayName = useGameStore.getState().onlineDisplayName.trim() || "Player";
          (async () => {
            try {
              await joinRoom({ code, displayName });
              await saveRoomSession({ roomId, displayName });
              trigger("gameStart");
              enterOnlineLobby({ roomId, displayName, code, isHost: false });
            } catch (err) {
              if (__DEV__) console.warn("[deep link] failed to join room", err);
            }
          })();
        }
      } catch (err) {
        if (__DEV__) console.warn("[deep link] parsing failed", err);
      }
    };

    // Listen for incoming deep links while app is running
    const subscription = Linking.addEventListener("url", (event: { url: string }) => {
      handleUrl(event.url);
    });

    // Check for initial URL if app was cold started from deep link
    Linking.getInitialURL().then((url: string | null) => {
      if (url) handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, joinRoom, enterOnlineLobby]);
}
