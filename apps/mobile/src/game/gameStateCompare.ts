import type { GameState, PlayerId } from "@durak/game-core";

/** Fingerprint gameplay fields that affect UI — ignores opponent hidden-card object identity. */
export function gameplayFingerprint(
  state: GameState,
  humanId: PlayerId,
): string {
  const humanHand = (state.hands[humanId] ?? []).map((c) => c.id).join(",");
  const table = state.table
    .map((p) => `${p.attack.id}:${p.defense?.id ?? ""}`)
    .join("|");
  const counts = state.players
    .map((p) => `${p}=${(state.hands[p] ?? []).length}`)
    .join(",");
  return [
    state.phase,
    state.attackerId,
    state.defenderId,
    state.takeInProgress ? "1" : "0",
    state.trumpSuit,
    state.trumpCard?.id ?? "",
    state.deck.length,
    state.discard.length,
    state.passed.join(","),
    state.finishedOrder.join(","),
    humanHand,
    table,
    counts,
  ].join(";");
}

export function namesEqual(
  a: Record<PlayerId, string>,
  b: Record<PlayerId, string>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k as PlayerId] !== b[k as PlayerId]) return false;
  }
  return true;
}
