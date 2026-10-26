import React from "react";
import {
  canThrowIn,
  undefendedCount,
  humanMustAct,
  type GameState,
  type PlayerId,
} from "@durak/game-core";

export type TurnTone =
  | "you"
  | "waiting"
  | "confirming"
  | "reconnecting"
  | "neutral";

export function getTurnStatus(
  game: GameState,
  humanId: PlayerId,
  names: Record<string, string>,
  options?: {
    submittingMove?: boolean;
    opponentReconnecting?: boolean;
  },
): { text: string; tone: TurnTone } {
  if (options?.submittingMove) {
    return { text: "Sending move…", tone: "confirming" };
  }
  if (options?.opponentReconnecting) {
    return { text: "Opponent reconnecting…", tone: "reconnecting" };
  }

  if (game.phase === "gameOver") {
    if (game.loserId === humanId) {
      return { text: "Game Over — You are the Durak!", tone: "neutral" };
    }
    if (game.finishedOrder.includes(humanId)) {
      return { text: "Victory! You won!", tone: "you" };
    }
    return { text: "Game Over", tone: "neutral" };
  }

  if (game.finishedOrder.includes(humanId)) {
    return { text: "You're out — watching", tone: "neutral" };
  }

  const nameOf = (id: PlayerId) => names[id] ?? "Opponent";
  const isDefender = game.defenderId === humanId;
  const undef = undefendedCount(game);

  if (game.takeInProgress) {
    if (isDefender) return { text: "Taking cards…", tone: "neutral" };
    if (canThrowIn(game, humanId)) {
      return { text: "Throw in more cards or wait", tone: "you" };
    }
    return {
      text: `${nameOf(game.defenderId)} is taking cards`,
      tone: "waiting",
    };
  }

  if (undef > 0) {
    if (isDefender) {
      return {
        text:
          undef === 1
            ? "Your turn to defend — beat 1 card or take"
            : `Your turn to defend — beat ${undef} cards or take`,
        tone: "you",
      };
    }
    const defenderName = nameOf(game.defenderId);
    return {
      text:
        undef === 1
          ? `Waiting for ${defenderName} to beat 1 card`
          : `Waiting for ${defenderName} to beat ${undef} cards`,
      tone: "waiting",
    };
  }

  if (game.table.length === 0) {
    if (game.attackerId === humanId) {
      return { text: "Your turn to attack — play a card", tone: "you" };
    }
    return {
      text: `Waiting for ${nameOf(game.attackerId)} to attack`,
      tone: "waiting",
    };
  }

  if (canThrowIn(game, humanId)) {
    return { text: "Throw in a matching card or press Done", tone: "you" };
  }
  if (isDefender) {
    return { text: "Defended — waiting on throw-ins", tone: "waiting" };
  }
  return { text: "Waiting for attackers to throw in or pass", tone: "waiting" };
}

export const TurnStatusBanner: React.FC<{
  game: GameState;
  humanId: PlayerId;
  names: Record<string, string>;
  submittingMove?: boolean;
  opponentReconnecting?: boolean;
}> = ({ game, humanId, names, submittingMove, opponentReconnecting }) => {
  const status = getTurnStatus(game, humanId, names, {
    submittingMove,
    opponentReconnecting,
  });
  const myTurn =
    !submittingMove &&
    !opponentReconnecting &&
    game.phase === "playing" &&
    !game.finishedOrder.includes(humanId) &&
    humanMustAct(game, humanId);

  return (
    <div
      className={`turn-status-banner tone-${status.tone} ${myTurn ? "my-turn" : ""}`}
      role="status"
    >
      <span className="turn-status-dot" />
      <span className="turn-status-text">{status.text}</span>
    </div>
  );
};
