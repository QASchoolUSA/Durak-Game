/** Match credit buy-in and pot (regular coins). */
export const MATCH_BUY_IN = 100;

export function matchPot(numPlayers: number, buyIn = MATCH_BUY_IN): number {
  const n = Math.max(0, Math.floor(numPlayers));
  return buyIn * n;
}
