import React from "react";
import { useGameStore } from "../store/gameStore";
import { APPEARANCE_ORDER, APPEARANCE_PRESETS } from "../theme/appearanceThemes";
import { getCardTheme } from "../theme/cardThemes";
import { TURN_SECONDS_OPTIONS } from "../store/storage";
import {
  isSoundEnabled,
  setSoundEnabled,
  isHapticsEnabled,
  setHapticsEnabled,
  trigger as fireFeedback,
} from "../feedback/feedback";
import { Card } from "./Card";

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
  const cardDesign = useGameStore((s) => s.cardDesign);
  const setCardDesign = useGameStore((s) => s.setCardDesign);
  const turnTimerSeconds = useGameStore((s) => s.turnTimerSeconds);
  const applyTurnTimerMidGame = useGameStore((s) => s.applyTurnTimerMidGame);

  const [sound, setSound] = React.useState(isSoundEnabled());
  const [haptics, setHaptics] = React.useState(isHapticsEnabled());

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
          <div className="settings-row">
            <div className="settings-label">TURN TIMER</div>
            <div className="settings-options">
              {TURN_SECONDS_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={`settings-opt-btn ${turnTimerSeconds === s ? "active" : ""}`}
                  onClick={() => applyTurnTimerMidGame(s)}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">SOUND</div>
            <div className="settings-options">
              <button
                className={`settings-opt-btn ${sound ? "active" : ""}`}
                onClick={() => {
                  setSound(true);
                  setSoundEnabled(true);
                  fireFeedback("uiTap");
                }}
              >
                On
              </button>
              <button
                className={`settings-opt-btn ${!sound ? "active" : ""}`}
                onClick={() => {
                  setSound(false);
                  setSoundEnabled(false);
                }}
              >
                Off
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">VIBRATION</div>
            <div className="settings-options">
              <button
                className={`settings-opt-btn ${haptics ? "active" : ""}`}
                onClick={() => {
                  setHaptics(true);
                  setHapticsEnabled(true);
                  fireFeedback("selection");
                }}
              >
                On
              </button>
              <button
                className={`settings-opt-btn ${!haptics ? "active" : ""}`}
                onClick={() => {
                  setHaptics(false);
                  setHapticsEnabled(false);
                }}
              >
                Off
              </button>
            </div>
          </div>

          <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
            <div className="settings-label">APPEARANCE</div>
            <div className="appearance-scroll-container">
              {APPEARANCE_ORDER.map((id) => {
                const preset = APPEARANCE_PRESETS[id];
                const cardTheme = getCardTheme(id);
                const selected = cardDesign === id;
                const swatchBg = preset.table.backgroundGradient 
                  ? `linear-gradient(180deg, ${preset.table.backgroundGradient.join(", ")})`
                  : preset.table.backgroundColor;

                return (
                  <div
                    key={id}
                    className={`appearance-tile ${selected ? "active" : ""}`}
                    onClick={() => setCardDesign(id)}
                  >
                    <div className="appearance-swatch" style={{ background: swatchBg }}>
                      <div className="appearance-card-preview-stack">
                        <Card
                          card={{ rank: 14, suit: "spades", id: `prev-${id}-face` }}
                          themeOverride={cardTheme}
                          style={{
                            width: "30px",
                            height: "44px",
                            boxShadow: "none",
                            pointerEvents: "none",
                            position: "absolute",
                            left: "6px",
                            top: "6px",
                            zIndex: 2,
                            borderRadius: "4px"
                          }}
                        />
                        <Card
                          faceDown
                          themeOverride={cardTheme}
                          style={{
                            width: "30px",
                            height: "44px",
                            boxShadow: "none",
                            pointerEvents: "none",
                            position: "absolute",
                            left: "16px",
                            top: "12px",
                            zIndex: 1,
                            borderRadius: "4px"
                          }}
                        />
                      </div>
                    </div>
                    <div className="appearance-tile-name">{preset.name}</div>
                    <div className={`appearance-tile-mode-badge ${preset.mode}`}>{preset.mode}</div>
                  </div>
                );
              })}
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
