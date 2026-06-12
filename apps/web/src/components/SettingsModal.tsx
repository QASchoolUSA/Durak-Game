import React from "react";
import { useGameStore } from "../store/gameStore";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const numPlayers = useGameStore((s) => s.numPlayers);
  const setNumPlayers = useGameStore((s) => s.setNumPlayers);
  const variant = useGameStore((s) => s.variant);
  const setVariant = useGameStore((s) => s.setVariant);
  const throwInScope = useGameStore((s) => s.throwInScope);
  const setThrowInScope = useGameStore((s) => s.setThrowInScope);
  const playStyle = useGameStore((s) => s.playStyle);
  const setPlayStyle = useGameStore((s) => s.setPlayStyle);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h3>GAME SETTINGS</h3>
        <div className="settings-list">
          
          <div className="settings-row">
            <div className="settings-label">BOT DIFFICULTY</div>
            <div className="settings-options">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  className={`settings-opt-btn ${difficulty === d ? "active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">PLAYERS (SOLO)</div>
            <div className="settings-options">
              {([2, 3, 4, 5, 6] as const).map((n) => (
                <button
                  key={n}
                  className={`settings-opt-btn ${numPlayers === n ? "active" : ""}`}
                  onClick={() => setNumPlayers(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">VARIANT</div>
            <div className="settings-options">
              <button
                className={`settings-opt-btn ${variant === "podkidnoy" ? "active" : ""}`}
                onClick={() => setVariant("podkidnoy")}
              >
                Classic (Podkidnoy)
              </button>
              <button
                className={`settings-opt-btn ${variant === "perevodnoy" ? "active" : ""}`}
                onClick={() => setVariant("perevodnoy")}
              >
                Passing (Perevodnoy)
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">THROW-IN SCOPE</div>
            <div className="settings-options">
              <button
                className={`settings-opt-btn ${throwInScope === "all" ? "active" : ""}`}
                onClick={() => setThrowInScope("all")}
              >
                All Players
              </button>
              <button
                className={`settings-opt-btn ${throwInScope === "neighbor" ? "active" : ""}`}
                onClick={() => setThrowInScope("neighbor")}
              >
                Neighbors Only
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">PLAY STYLE</div>
            <div className="settings-options">
              <button
                className={`settings-opt-btn ${playStyle === "standard" ? "active" : ""}`}
                onClick={() => setPlayStyle("standard")}
              >
                Standard
              </button>
              <button
                className={`settings-opt-btn ${playStyle === "abilities" ? "active" : ""}`}
                onClick={() => setPlayStyle("abilities")}
              >
                Abilities (Powers)
              </button>
            </div>
          </div>

        </div>
        <button className="btn btn-primary btn-md" style={{ marginTop: "10px" }} onClick={onClose}>
          Save Settings
        </button>
      </div>
    </div>
  );
};
