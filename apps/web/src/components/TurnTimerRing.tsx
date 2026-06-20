import React from "react";

interface TurnTimerRingProps {
  secondsLeft: number;
  totalSeconds: number;
  size?: number;
}

/** Circular countdown ring; color shifts green → amber → red as time runs out. */
export const TurnTimerRing: React.FC<TurnTimerRingProps> = ({
  secondsLeft,
  totalSeconds,
  size = 44,
}) => {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const frac = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const offset = circumference * (1 - frac);
  const color = frac > 0.5 ? "#5BD6A0" : frac > 0.2 ? "#E8B23A" : "#E0556B";
  const display = Math.max(0, Math.ceil(secondsLeft));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="rgba(0,0,0,0.28)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s linear" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill={color}
        fontSize={size * 0.4}
        fontWeight={800}
        fontFamily="var(--font-family)"
      >
        {display}
      </text>
    </svg>
  );
};
