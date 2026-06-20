import React from "react";

function Coin({ variant }: { variant: "credit" | "gold" }) {
  const top = variant === "gold" ? "#F5D27A" : "#9FE0C2";
  const bottom = variant === "gold" ? "#C99A33" : "#3E9C76";
  const ring = variant === "gold" ? "#8A6A1E" : "#2C7355";
  const gid = `coin-${variant}`;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <circle cx="8" cy="8" r="7" fill={`url(#${gid})`} stroke={ring} strokeWidth="1" />
      <circle cx="8" cy="8" r="4.4" fill="none" stroke={ring} strokeWidth="0.8" opacity="0.6" />
      <ellipse cx="6" cy="5.4" rx="2.4" ry="1.3" fill="#fff" opacity="0.35" />
    </svg>
  );
}

interface EconomyBarProps {
  credits: number;
  gold: number;
  showSignOut?: boolean;
  onSignOut?: () => void;
}

/** Credits + gold display, reused in the global header. Mirrors mobile EconomyBar. */
export const EconomyBar: React.FC<EconomyBarProps> = ({ credits, gold, showSignOut, onSignOut }) => (
  <div className="economy-bar">
    <div className="stat-pill" title="Credits">
      <Coin variant="credit" />
      <span>{credits.toLocaleString()}</span>
    </div>
    <div className="stat-pill gold" title="Gold">
      <Coin variant="gold" />
      <span>{gold.toLocaleString()}</span>
    </div>
    {showSignOut && (
      <button className="btn btn-secondary btn-sm" onClick={onSignOut}>
        Sign Out
      </button>
    )}
  </div>
);
