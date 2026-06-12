import React from "react";
import { useGameStore } from "../store/gameStore";

export const Result: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const names = useGameStore((s) => s.names);
  const playMode = useGameStore((s) => s.playMode);
  const pot = useGameStore((s) => s.pot);
  
  const goHome = useGameStore((s) => s.goHome);
  const startGame = useGameStore((s) => s.startGame);

  if (!game) return null;

  const isWinner = game.finishedOrder[0] === humanId;
  const isLoser = game.loserId === humanId;
  const isDraw = game.loserId === null;

  // Compile final scoreboard rankings
  const rankings = [];
  
  // Winners in finish order
  game.finishedOrder.forEach((pId, idx) => {
    rankings.push({
      player: names[pId] || pId,
      status: `Place #${idx + 1} (Winner)`,
      pId,
    });
  });

  // Loser/Durak
  if (game.loserId) {
    rankings.push({
      player: names[game.loserId] || game.loserId,
      status: "Loser (Durak 🃏)",
      pId: game.loserId,
    });
  } else if (isDraw) {
    // If draw, check players who didn't finish
    game.players.forEach((pId) => {
      if (!game.finishedOrder.includes(pId)) {
        rankings.push({
          player: names[pId] || pId,
          status: "Draw",
          pId,
        });
      }
    });
  }

  const resultTitle = isWinner ? "VICTORY" : isLoser ? "DEFEAT" : "DRAW";
  const resultClass = isWinner ? "win" : isLoser ? "lose" : "draw";

  return (
    <div className="home-container">
      <div className="hero-panel result-panel" style={{ maxWidth: "440px" }}>
        <div className={`result-header ${resultClass}`}>{resultTitle}</div>
        
        <div className="result-details">
          <div style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "1px" }}>
            FINAL STANDINGS
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "8px 0" }}>
            {rankings.map((rank, i) => (
              <div
                key={i}
                className="result-row"
                style={{
                  borderLeft: rank.pId === humanId ? "3px solid var(--gold)" : "none",
                  paddingLeft: rank.pId === humanId ? "8px" : "0",
                }}
              >
                <span>{rank.player}</span>
                <span>{rank.status}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--panel-border-inner)", paddingTop: "12px", display: "flex", justifyContent: "space-between" }}>
            <span>Match Pot:</span>
            <span style={{ color: "var(--gold-bright)", fontWeight: "900" }}>💰 {pot} Credits</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-muted)" }}>
            <span>Earnings:</span>
            <span>
              {isWinner
                ? `+${pot} Credits`
                : isDraw
                  ? `+${pot / game.players.length} Credits`
                  : "+0 Credits"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
          {playMode === "solo" && (
            <button className="btn btn-primary btn-md" onClick={() => startGame()}>
              Play Again
            </button>
          )}
          <button className="btn btn-secondary btn-md" onClick={goHome}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
