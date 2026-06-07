export interface CardFlightStep {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  flightMs: number;
}

export function cardFlightDurationMs(queue: CardFlightStep[]): number {
  if (queue.length === 0) return 0;
  return queue.reduce((total, step) => total + step.flightMs + 60, 0);
}
