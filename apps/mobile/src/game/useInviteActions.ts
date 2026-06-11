import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useGameStore } from "./store";
import { usePreferencesStore } from "./preferencesStore";
import { useOnlineAuth } from "./useAuthBootstrap";
import { saveRoomSession } from "./onlineSessionStorage";
import { trigger } from "../feedback/haptics";

/**
 * Shared accept/decline/send logic for game invites, reusing the existing
 * online room join flow (`enterOnlineLobby`).
 */
export function useInviteActions() {
  const sendInviteMut = useMutation(api.invites.sendInvite);
  const acceptInviteMut = useMutation(api.invites.acceptInvite);
  const declineInviteMut = useMutation(api.invites.declineInvite);
  const joinRoom = useMutation(api.rooms.joinRoom);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);
  const { ensureAuthenticated } = useOnlineAuth();

  const sendInvite = useCallback(
    async (toUserId: Id<"users">) => {
      await ensureAuthenticated();
      const state = useGameStore.getState();
      const name = state.onlineDisplayName.trim() || "Player";
      const config = {
        numPlayers: state.numPlayers,
        variant: state.variant,
        throwInScope: state.throwInScope,
        playStyle: state.playStyle,
        difficulty: state.difficulty,
      };
      const turnTimerSeconds = usePreferencesStore.getState().turnSeconds;
      const { roomId, code } = await sendInviteMut({
        toUserId,
        config,
        displayName: name,
        turnTimerSeconds,
      });
      await saveRoomSession({ roomId, displayName: name });
      trigger("gameStart");
      enterOnlineLobby({ roomId, displayName: name, code, isHost: true });
    },
    [ensureAuthenticated, sendInviteMut, enterOnlineLobby],
  );

  const acceptInvite = useCallback(
    async (inviteId: Id<"gameInvites">) => {
      await ensureAuthenticated();
      const name = useGameStore.getState().onlineDisplayName.trim() || "Player";
      const { roomId, code } = await acceptInviteMut({ inviteId });
      await joinRoom({ code, displayName: name });
      await saveRoomSession({ roomId, displayName: name });
      trigger("gameStart");
      enterOnlineLobby({ roomId, displayName: name, code, isHost: false });
    },
    [ensureAuthenticated, acceptInviteMut, joinRoom, enterOnlineLobby],
  );

  const declineInvite = useCallback(
    async (inviteId: Id<"gameInvites">) => {
      await declineInviteMut({ inviteId });
    },
    [declineInviteMut],
  );

  return { sendInvite, acceptInvite, declineInvite };
}
