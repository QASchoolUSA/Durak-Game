import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../mobile/convex/_generated/api";
import { useOnlineAuth } from "../auth/AuthGateProvider";
import { useGameStore } from "../store/gameStore";
import { SettingsModal } from "./SettingsModal";
import { RulesModal } from "./RulesModal";
import { Card } from "./Card";

export const Home: React.FC = () => {
  const { ensureAuthenticated } = useOnlineAuth();

  const onlineDisplayName = useGameStore((s) => s.onlineDisplayName);
  const setOnlineDisplayName = useGameStore((s) => s.setOnlineDisplayName);

  const startGame = useGameStore((s) => s.startGame);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);
  const setPlayMode = useGameStore((s) => s.setPlayMode);
  
  const numPlayers = useGameStore((s) => s.numPlayers);
  const variant = useGameStore((s) => s.variant);
  const throwInScope = useGameStore((s) => s.throwInScope);
  const playStyle = useGameStore((s) => s.playStyle);
  const difficulty = useGameStore((s) => s.difficulty);

  const createRoomMutation = useMutation(api.rooms.createRoom);
  const joinRoomMutation = useMutation(api.rooms.joinRoom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  
  const [roomAction, setRoomAction] = useState<"none" | "create" | "join">("none");
  const [joinCode, setJoinCode] = useState("");
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureAuthenticated();
      setPlayMode("online");
      const result = await createRoomMutation({
        displayName: onlineDisplayName,
        config: {
          numPlayers,
          difficulty,
          variant,
          throwInScope,
          playStyle,
        },
        buyIn: buyInAmount,
      });
      
      enterOnlineLobby({
        roomId: result.roomId,
        displayName: onlineDisplayName,
        code: result.code,
        isHost: true,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to create room.");
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setError("Please enter a room code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureAuthenticated();
      setPlayMode("online");
      const result = await joinRoomMutation({
        code: joinCode.trim().toUpperCase(),
        displayName: onlineDisplayName,
      });
      
      enterOnlineLobby({
        roomId: result.roomId,
        displayName: onlineDisplayName,
        code: joinCode.trim().toUpperCase(),
        isHost: false,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to join room. Check the code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home-container">
      <div className="hero-panel" style={{ maxWidth: "520px" }}>
        <div className="card-fan">
          <div className="deco-card"><Card faceDown style={{ width: "100%", height: "100%", boxShadow: "none" }} /></div>
          <div className="deco-card"><Card faceDown style={{ width: "100%", height: "100%", boxShadow: "none" }} /></div>
          <div className="deco-card"><Card faceDown style={{ width: "100%", height: "100%", boxShadow: "none" }} /></div>
          <div className="deco-card"><Card faceDown style={{ width: "100%", height: "100%", boxShadow: "none" }} /></div>
        </div>

        <h1 className="glow-title">DURAK</h1>

        {/* Player name edit */}
        <div className="form-group" style={{ margin: "10px 0" }}>
          <label className="form-label">Your Display Name</label>
          <input
            className="form-input"
            type="text"
            value={onlineDisplayName}
            onChange={(e) => setOnlineDisplayName(e.target.value.slice(0, 12))}
            placeholder="Guest Player"
          />
        </div>

        {roomAction === "none" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <button className="btn btn-primary btn-lg" onClick={() => startGame()}>
              Play Solo (VS Bots)
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setRoomAction("create");
                setError(null);
              }}
            >
              Create Online Game
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setRoomAction("join");
                setError(null);
              }}
            >
              Join Online Game
            </button>
            <button className="btn btn-secondary btn-md" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
            <button className="btn btn-secondary btn-md" onClick={() => setRulesOpen(true)}>
              How to Play
            </button>
          </div>
        )}

        {roomAction === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--gold-bright)" }}>
              CREATE GAME ROOM
            </div>
            <div className="form-group">
              <label className="form-label">Buy-In Amount (Credits)</label>
              <select
                className="form-input"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(Number(e.target.value))}
              >
                <option value={50}>50 Credits</option>
                <option value={100}>100 Credits (Standard)</option>
                <option value={200}>200 Credits</option>
                <option value={500}>500 Credits</option>
              </select>
            </div>
            
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={handleCreateRoom} disabled={busy}>
                {busy ? "Creating..." : "Create"}
              </button>
              <button className="btn btn-secondary btn-md" style={{ flex: 1 }} onClick={() => setRoomAction("none")}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {roomAction === "join" && (
          <form onSubmit={handleJoinRoom} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--gold-bright)" }}>
              JOIN GAME ROOM
            </div>
            <div className="form-group">
              <label className="form-label">Enter 4-Character Room Code</label>
              <input
                className="form-input"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="ABCD"
                style={{ textAlign: "center", fontSize: "24px", letterSpacing: "4px", fontWeight: "900" }}
                disabled={busy}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn btn-primary btn-md" style={{ flex: 1 }} type="submit" disabled={busy}>
                {busy ? "Joining..." : "Join"}
              </button>
              <button className="btn btn-secondary btn-md" style={{ flex: 1 }} type="button" onClick={() => setRoomAction("none")}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <div className="error-message" style={{ marginTop: "10px" }}>{error}</div>}
      </div>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesModal visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
};
