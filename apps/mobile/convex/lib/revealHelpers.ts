import type { GameState, PlayerId } from "@durak/game-core";
import { sortHandForDisplay } from "./handSort";

export function revealEligibleOpponents(state: GameState, human: PlayerId): PlayerId[] {
  return state.players.filter(
    (id) =>
      id !== human &&
      !state.finishedOrder.includes(id) &&
      (state.hands[id]?.length ?? 0) > 1,
  );
}

export function canReveal(state: GameState, human: PlayerId): boolean {
  if (state.phase !== "playing") return false;
  return revealEligibleOpponents(state, human).length > 0;
}

export function pickRevealedCard(
  state: GameState,
  human: PlayerId,
  opponentId: PlayerId,
  cardIndex: number,
) {
  if (!canReveal(state, human)) {
    throw new Error("Reveal is not available");
  }
  if (!revealEligibleOpponents(state, human).includes(opponentId)) {
    throw new Error("Invalid reveal target");
  }
  const sorted = sortHandForDisplay(state.hands[opponentId] ?? [], state.trumpSuit);
  const card = sorted[cardIndex];
  if (!card) {
    throw new Error("Invalid card selection");
  }
  return card;
}
