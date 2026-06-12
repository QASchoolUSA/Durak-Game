import React from "react";
import {
  type Card as CardModel,
  RANK_LABELS,
  SUIT_SYMBOLS,
  isRed,
} from "@durak/game-core";
import { useGameStore } from "../store/gameStore";
import { getCardTheme, type CardTheme } from "../theme/cardThemes";

export interface CardProps {
  card?: CardModel;
  faceDown?: boolean;
  trump?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  themeOverride?: CardTheme;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const BackCrest: React.FC<{ accent: string; accentSoft: string }> = ({ accent, accentSoft }) => (
  <g transform="translate(42.5, 62.5)">
    <path d="M-15,-15 H-10 M-15,-15 V-10" stroke={accent} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M15,-15 H10 M15,-15 V-10" stroke={accent} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M-15,15 H-10 M-15,15 V10" stroke={accent} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M15,15 H10 M15,15 V10" stroke={accent} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    
    <circle cx="-8" cy="-8" r="1.5" fill={accentSoft} fillOpacity="0.45" />
    <circle cx="8" cy="-8" r="1.5" fill={accentSoft} fillOpacity="0.45" />
    <circle cx="-8" cy="8" r="1.5" fill={accentSoft} fillOpacity="0.45" />
    <circle cx="8" cy="8" r="1.5" fill={accentSoft} fillOpacity="0.45" />
    
    <rect x="-8" y="-8" width="16" height="16" rx="1.5" transform="rotate(45)" fill="none" stroke={accent} strokeWidth="2" />
    <rect x="-3" y="-3" width="6" height="6" rx="1" transform="rotate(45)" fill={accent} fillOpacity="0.92" />
  </g>
);

const BackSeal: React.FC<{ accent: string; accentSoft: string }> = ({ accent, accentSoft }) => (
  <g transform="translate(42.5, 62.5)">
    <circle cx="0" cy="0" r="27.5" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.55" />
    <circle cx="0" cy="0" r="20" fill="none" stroke={accentSoft} strokeWidth="2" strokeOpacity="0.75" />
    <circle cx="0" cy="0" r="12" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.9" />
    
    <rect x="-2.5" y="-2.5" width="5" height="5" rx="1" transform="translate(0, -20) rotate(45)" fill={accentSoft} fillOpacity="0.6" />
    <rect x="-2.5" y="-2.5" width="5" height="5" rx="1" transform="translate(0, 20) rotate(45)" fill={accentSoft} fillOpacity="0.6" />
    <rect x="-2.5" y="-2.5" width="5" height="5" rx="1" transform="translate(-20, 0) rotate(45)" fill={accentSoft} fillOpacity="0.6" />
    <rect x="-2.5" y="-2.5" width="5" height="5" rx="1" transform="translate(20, 0) rotate(45)" fill={accentSoft} fillOpacity="0.6" />
    
    <circle cx="0" cy="0" r="3.8" fill={accent} fillOpacity="0.95" />
  </g>
);

const BackWeave: React.FC<{ accent: string; accentSoft: string }> = ({ accent, accentSoft }) => (
  <g transform="translate(42.5, 62.5)">
    <g stroke={accentSoft} strokeWidth="1.5" strokeOpacity="0.35">
      <g transform="rotate(45)">
        {[-2, -1, 0, 1, 2].map((i) => (
          <line key={i} x1="-50" y1={i * 11} x2="50" y2={i * 11} />
        ))}
      </g>
      <g transform="rotate(-45)">
        {[-2, -1, 0, 1, 2].map((i) => (
          <line key={i} x1="-50" y1={i * 11} x2="50" y2={i * 11} />
        ))}
      </g>
    </g>
    
    <rect x="-30" y="-4.5" width="60" height="9" rx="2" fill={accent} fillOpacity="0.55" />
    <rect x="-5.3" y="-5.3" width="10.6" height="10.6" rx="2" transform="rotate(45)" fill="none" stroke={accentSoft} strokeWidth="2" />
  </g>
);

const BackSunburst: React.FC<{ accent: string; accentSoft: string }> = ({ accent, accentSoft }) => (
  <g transform="translate(42.5, 62.5)">
    <circle cx="0" cy="0" r="26" fill="none" stroke={accentSoft} strokeWidth="2" strokeOpacity="0.5" />
    
    <g strokeWidth="1.5" strokeOpacity="0.7">
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={i}
          x1="0"
          y1="-26"
          x2="0"
          y2="26"
          transform={`rotate(${i * 22.5})`}
          stroke={i % 2 === 0 ? accent : accentSoft}
        />
      ))}
    </g>
    
    <circle cx="0" cy="0" r="8.4" fill="none" stroke={accent} strokeWidth="2" strokeOpacity="0.85" />
    <circle cx="0" cy="0" r="5.3" fill={accent} fillOpacity="0.95" />
  </g>
);

const CardBackPattern: React.FC<{
  pattern: string;
  accent: string;
  accentSoft: string;
}> = ({ pattern, accent, accentSoft }) => {
  switch (pattern) {
    case "seal":
      return <BackSeal accent={accent} accentSoft={accentSoft} />;
    case "weave":
      return <BackWeave accent={accent} accentSoft={accentSoft} />;
    case "sunburst":
      return <BackSunburst accent={accent} accentSoft={accentSoft} />;
    case "crest":
    default:
      return <BackCrest accent={accent} accentSoft={accentSoft} />;
  }
};

export const Card: React.FC<CardProps> = React.memo(({
  card,
  faceDown,
  trump,
  dimmed,
  highlighted,
  selected,
  onClick,
  style,
  themeOverride,
  draggable,
  onDragStart,
  onDragEnd,
}) => {
  const cardDesign = useGameStore((s) => s.cardDesign);
  const theme = themeOverride ?? getCardTheme(cardDesign);
  const isCardFaceDown = faceDown || !card;

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  if (isCardFaceDown) {
    const startColor = theme.backLight ?? theme.back;
    const endColor = theme.back;
    const accentSoft = theme.backAccentSoft ?? theme.backAccent;
    const scale = style?.width ? (parseFloat(style.width as string) / 85) : 1;

    return (
      <div
        className={`card card-back ${dimmed ? "dimmed" : ""} ${highlighted ? "highlighted" : ""}`}
        onClick={handleCardClick}
        style={{
          backgroundColor: theme.back,
          borderColor: theme.backAccent,
          "--card-font-scale": scale,
          ...style,
        } as React.CSSProperties}
      >
        <svg width="100%" height="100%" viewBox="0 0 85 125" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
          <defs>
            <linearGradient id={`backGrad-${theme.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={startColor} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>
          
          {/* Outer panel rim */}
          <rect x="2" y="2" width="81" height="121" rx="7" fill={`url(#backGrad-${theme.id})`} stroke={theme.backAccent} strokeWidth="1.5" strokeOpacity="0.55" />
          
          {/* Outer Frame */}
          <rect x="6" y="6" width="73" height="113" rx="5" fill="none" stroke={theme.backAccent} strokeWidth="2" />
          
          {/* Inner Frame */}
          <rect x="10" y="10" width="65" height="105" rx="4" fill="none" stroke={theme.backAccent} strokeWidth="1" strokeOpacity="0.38" />
          
          {/* Pattern in Center */}
          <CardBackPattern pattern={theme.backPattern} accent={theme.backAccent} accentSoft={accentSoft} />
        </svg>
      </div>
    );
  }

  const redSuit = isRed(card.suit);
  const color = redSuit ? theme.suitRed : theme.suitBlack;
  const label = RANK_LABELS[card.rank];
  const symbol = SUIT_SYMBOLS[card.suit];

  const faceGradient = `linear-gradient(135deg, #FFFFFF 0%, ${theme.face} 100%)`;
  const scale = style?.width ? (parseFloat(style.width as string) / 85) : 1;

  return (
    <div
      className={`card ${dimmed ? "dimmed" : ""} ${
        highlighted ? "highlighted" : ""
      } ${selected ? "selected" : ""} ${trump ? "trump-highlight" : ""}`}
      onClick={handleCardClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: faceGradient,
        borderColor: trump ? "var(--gold-bright)" : theme.faceEdge,
        color: color,
        borderWidth: trump ? "2px" : "1.5px",
        "--card-font-scale": scale,
        ...style,
      } as React.CSSProperties}
    >
      <div className="card-corner tl" style={{ color }}>
        <span className="card-value">{label}</span>
        <span className="card-suit">{symbol}</span>
      </div>
      <div className="card-center-suit" style={{ color }}>{symbol}</div>
      <div className="card-corner br" style={{ color }}>
        <span className="card-value">{label}</span>
        <span className="card-suit">{symbol}</span>
      </div>
    </div>
  );
});

Card.displayName = "Card";
