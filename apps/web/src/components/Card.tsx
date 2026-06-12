import React from "react";
import {
  type Card as CardModel,
  RANK_LABELS,
  SUIT_SYMBOLS,
  isRed,
} from "@durak/game-core";

export interface CardProps {
  card?: CardModel;
  faceDown?: boolean;
  trump?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = React.memo(({
  card,
  faceDown,
  trump,
  dimmed,
  highlighted,
  selected,
  onClick,
  style,
}) => {
  const isCardFaceDown = faceDown || !card;

  if (isCardFaceDown) {
    return (
      <div
        className={`card card-back ${dimmed ? "dimmed" : ""} ${highlighted ? "highlighted" : ""}`}
        onClick={onClick}
        style={style}
      >
        <div className="card-back-pattern" />
      </div>
    );
  }

  const redSuit = isRed(card.suit);
  const colorClass = redSuit ? "red" : "black";
  const label = RANK_LABELS[card.rank];
  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <div
      className={`card ${colorClass} ${dimmed ? "dimmed" : ""} ${
        highlighted ? "highlighted" : ""
      } ${selected ? "selected" : ""} ${trump ? "trump-highlight" : ""}`}
      onClick={onClick}
      style={style}
    >
      <div className="card-top">
        <span className="card-value-label">{label}</span>
        <span className="card-suit-small">{symbol}</span>
      </div>
      <div className="card-center">{symbol}</div>
      <div className="card-bottom">
        <span className="card-value-label">{label}</span>
        <span className="card-suit-small">{symbol}</span>
      </div>
    </div>
  );
});

Card.displayName = "Card";
