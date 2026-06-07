/** Allowed turn-timer durations (seconds per turn). */
export const VALID_TURN_SECONDS = [10, 12, 15, 30] as const;

export type TurnSecondsOption = (typeof VALID_TURN_SECONDS)[number];

export const DEFAULT_TURN_SECONDS: TurnSecondsOption = 12;

/** Coerce stored or server values to a valid option (legacy 0/60 → default). */
export function normalizeTurnSeconds(
  raw: number | null | undefined,
): TurnSecondsOption {
  if (raw != null && (VALID_TURN_SECONDS as readonly number[]).includes(raw)) {
    return raw as TurnSecondsOption;
  }
  return DEFAULT_TURN_SECONDS;
}
