import React, { useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../mobile/convex/_generated/api";
import { useGameStore } from "../store/gameStore";
import { onlineSession } from "../store/onlineSession";

/** Home prompt to rejoin a lobby/playing seat still held on the server. */
export const ResumeGameBanner: React.FC = () => {
  const { isAuthenticated } = useConvexAuth();
  const screen = useGameStore((s) => s.screen);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);
  const setPlayMode = useGameStore((s) => s.setPlayMode);
  const [busy, setBusy] = useState(false);

  const rooms = useQuery(
    api.rooms.myActiveRooms,
    isAuthenticated && screen === "home" ? {} : "skip",
  );

  const room = useMemo(() => {
    if (!rooms || rooms.length === 0) return null;
    const playing = rooms.filter((r) => r.status === "playing");
    const pool = playing.length > 0 ? playing : rooms;
    return pool.find((r) => r.isYourTurn) ?? pool[0] ?? null;
  }, [rooms]);

  if (screen !== "home" || onlineRoomId || !room) return null;

  const opponents = room.opponents.filter(Boolean);
  const subtitle =
    opponents.length > 0
      ? `With ${opponents.join(", ")}`
      : `Tap to rejoin table ${room.code}`;

  const onResume = () => {
    if (busy) return;
    setBusy(true);
    const displayName =
      useGameStore.getState().onlineDisplayName.trim() || "Player";
    onlineSession.touchPlaySession({ roomId: room.roomId, displayName });
    setPlayMode("online");
    enterOnlineLobby({
      roomId: room.roomId,
      displayName,
      code: room.code,
      isHost: false,
    });
    setBusy(false);
  };

  return (
    <button
      type="button"
      className="resume-banner"
      onClick={onResume}
      disabled={busy}
    >
      <div className="resume-banner-text">
        <strong>
          {room.isYourTurn ? "Your turn — rejoin" : "Game in progress"}
        </strong>
        <span>{subtitle}</span>
      </div>
      <span className="resume-banner-cta">{busy ? "…" : "Resume"}</span>
    </button>
  );
};
