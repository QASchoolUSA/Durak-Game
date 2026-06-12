import React, { useMemo } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../mobile/convex/_generated/api";
import type { Id } from "../../../mobile/convex/_generated/dataModel";
import { useGameStore } from "../store/gameStore";

export const Lobby: React.FC = () => {
  const isAuthenticated = useConvexAuth().isAuthenticated;
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const onlineRoomCode = useGameStore((s) => s.onlineRoomCode);
  const onlineIsHost = useGameStore((s) => s.onlineIsHost);
  const goHome = useGameStore((s) => s.goHome);

  const startGameMutation = useMutation(api.rooms.startGame);
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom);
  const setReadyMutation = useMutation(api.rooms.setReady);
  const setLobbyBotMutation = useMutation(api.rooms.setLobbyBot);

  const roomView = useQuery(
    api.rooms.getRoomView,
    onlineRoomId && isAuthenticated
      ? { roomId: onlineRoomId as Id<"rooms"> }
      : "skip"
  );

  const members = roomView?.members ?? [];
  const humanCount = roomView?.humanCount ?? 0;
  const readyCount = roomView?.readyCount ?? 0;
  const allHumansReady = roomView?.allHumansReady ?? false;
  const code = roomView?.code ?? onlineRoomCode ?? "------";
  const maxSeats = roomView?.config.numPlayers ?? 2;
  const joinedCount = members.length;
  const isLocalReady = roomView?.yourIsReady ?? false;

  const seats = useMemo(() => {
    const slots = [];
    for (let i = 0; i < maxSeats; i++) {
      slots.push({
        seatIndex: i,
        member: members.find((m: any) => m.seatIndex === i),
      });
    }
    return slots;
  }, [members, maxSeats]);

  const hasEmptySeat = seats.some((s) => !s.member);

  const canHostStart =
    onlineIsHost &&
    ((joinedCount >= 2 && humanCount < 2) ||
      (humanCount >= 2 && allHumansReady));

  const handleToggleReady = async () => {
    if (!onlineRoomId || !isAuthenticated || humanCount < 2) return;
    try {
      await setReadyMutation({
        roomId: onlineRoomId as Id<"rooms">,
        ready: !isLocalReady,
      });
    } catch (err) {
      console.error("Failed to toggle ready", err);
    }
  };

  const handleStart = async (autoFill: boolean) => {
    if (!onlineRoomId || !isAuthenticated) return;
    try {
      await startGameMutation({
        roomId: onlineRoomId as Id<"rooms">,
        soloWithAi: false,
        autoFillEmptySeats: autoFill,
      });
    } catch (err) {
      console.error("Failed to start game", err);
    }
  };

  const handleLobbyBot = async (seatIndex: number, enabled: boolean) => {
    if (!onlineRoomId || !isAuthenticated) return;
    try {
      await setLobbyBotMutation({
        roomId: onlineRoomId as Id<"rooms">,
        seatIndex,
        enabled,
      });
    } catch (err) {
      console.error("Failed to set bot", err);
    }
  };

  const handleLeave = async () => {
    if (onlineRoomId && isAuthenticated) {
      try {
        await leaveRoomMutation({
          roomId: onlineRoomId as Id<"rooms">,
        });
      } catch (err) {
        console.error(err);
      }
    }
    goHome();
  };

  return (
    <div className="home-container">
      <div className="hero-panel lobby-panel" style={{ maxWidth: "600px" }}>
        <div style={{ fontSize: "28px", fontWeight: "900", letterSpacing: "2px", color: "var(--gold-bright)" }}>
          GAME LOBBY
        </div>
        <p className="tagline">Share the code below with your friends</p>

        <div className="room-code-display">
          <span className="code-title">ROOM CODE</span>
          <span className="code-value">{code}</span>
        </div>

        <div className="lobby-members">
          <div className="form-label" style={{ marginBottom: "6px" }}>
            SEATS ({joinedCount}/{maxSeats})
          </div>
          {seats.map(({ seatIndex, member }) => {
            if (!member) {
              return (
                <div key={seatIndex} className="lobby-member-row" style={{ borderStyle: "dashed", opacity: 0.7 }}>
                  <div className="lobby-member-name" style={{ color: "var(--text-faint)" }}>
                    Seat {seatIndex + 1} (Empty)
                  </div>
                  {onlineIsHost && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLobbyBot(seatIndex, true)}
                    >
                      + Add Bot
                    </button>
                  )}
                </div>
              );
            }

            const ready = member.isReady === true;

            return (
              <div
                key={seatIndex}
                className={`lobby-member-row ${member.isSelf ? "self" : ""}`}
              >
                <div className="lobby-member-name">
                  {member.isBot ? "🤖 Bot" : `👤 ${member.displayName}`}
                  {member.isSelf && <span style={{ color: "var(--gold)", marginLeft: "4px" }}> (you)</span>}
                </div>
                {member.isBot ? (
                  onlineIsHost && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleLobbyBot(seatIndex, false)}
                    >
                      Remove
                    </button>
                  )
                ) : (
                  humanCount >= 2 && (
                    <span
                      className="lobby-member-badge"
                      style={{
                        background: ready ? "var(--win)" : "var(--felt-edge)",
                        color: "var(--text-light)",
                      }}
                    >
                      {ready ? "Ready" : "Waiting"}
                    </span>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Lobby Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
          {onlineIsHost ? (
            canHostStart ? (
              <>
                <button className="btn btn-primary btn-md" onClick={() => handleStart(true)}>
                  Start Game (Fill with Bots)
                </button>
                {hasEmptySeat && (
                  <button className="btn btn-secondary btn-md" onClick={() => handleStart(false)}>
                    Start Game (As Is)
                  </button>
                )}
              </>
            ) : (
              <div className="stat-pill" style={{ justifyContent: "center" }}>
                {joinedCount < 2
                  ? "Add a bot or wait for friends to join"
                  : `Waiting for players to ready up (${readyCount}/${humanCount})`}
              </div>
            )
          ) : (
            <div className="stat-pill" style={{ justifyContent: "center" }}>
              {allHumansReady
                ? "Waiting for host to start..."
                : `Ready up to play (${readyCount}/${humanCount})`}
            </div>
          )}

          {humanCount >= 2 && (
            <button
              className={`btn ${isLocalReady ? "btn-secondary" : "btn-primary"} btn-md`}
              onClick={handleToggleReady}
            >
              {isLocalReady ? "Cancel Ready" : "I'm Ready"}
            </button>
          )}

          <button className="btn btn-danger btn-md" onClick={handleLeave}>
            Leave Lobby
          </button>
        </div>
      </div>
    </div>
  );
};
