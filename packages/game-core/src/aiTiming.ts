import type { AiDifficulty } from "./ai";

/** Pause before each bot move (ms). */
export const AI_DELAY_MS: Record<AiDifficulty, number> = {
  easy: 3000,
  medium: 2500,
  hard: 2000,
};

export const MIN_AI_DELAY_MS = 2000;

export function aiMoveDelayMs(difficulty: AiDifficulty): number {
  return Math.max(AI_DELAY_MS[difficulty], MIN_AI_DELAY_MS);
}
