import { MATCH_BUY_IN, matchPot } from "@durak/game-core";

/** Credits awarded to the human at match end (0 if loser with buy-in already paid). */
export function soloMatchEndCreditDelta(args: {
  isDraw: boolean;
  humanIsWinner: boolean;
  numPlayers: number;
  buyIn?: number;
}): number {
  const buyIn = args.buyIn ?? MATCH_BUY_IN;
  if (args.isDraw) return buyIn;
  if (args.humanIsWinner) return matchPot(args.numPlayers, buyIn);
  return 0;
}
