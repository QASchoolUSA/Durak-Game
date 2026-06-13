import type { Card } from "@durak/game-core";

export interface CardFlightStep {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  flightMs: number;
  card?: Card;
}

export function cardFlightDurationMs(queue: CardFlightStep[], staggerMs = 80): number {
  if (queue.length === 0) return 0;
  const flightMs = queue[0]?.flightMs ?? 220;
  return (queue.length - 1) * staggerMs + flightMs;
}

