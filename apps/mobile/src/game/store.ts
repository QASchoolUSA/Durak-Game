import { create } from "zustand";
import {
  type GameState,
  type GameVariant,
  type Move,
  type PlayerId,
  type ThrowInScope,
  applyMove,
  createGame,
  pickMove,
} from "@durak/game-core";
import { timing } from "../theme";
import { safeMoveFor } from "./autoMove";
import {
  createBeatTransferDebugState,
  type DebugScenario,
} from "./debugScenarios";

export type Screen = "home" | "game" | "result";

const HUMAN_ID: PlayerId = "you";
const BOT_NAMES = ["Olga", "Ivan", "Dmitri"];

function buildPlayers(n: number): { ids: PlayerId[]; names: Record<PlayerId, string> } {
  const ids: PlayerId[] = [HUMAN_ID];
  const names: Record<PlayerId, string> = { [HUMAN_ID]: "You" };
  for (let i = 0; i < n - 1; i++) {
    const id = `bot${i + 1}`;
    ids.push(id);
    names[id] = BOT_NAMES[i] ?? `Bot ${i + 1}`;
  }
  return { ids, names };
}

interface GameStore {
  screen: Screen;
  numPlayers: number;
  variant: GameVariant;
  throwInScope: ThrowInScope;
  humanId: PlayerId;
  names: Record<PlayerId, string>;
  game: GameState | null;
  /** When set, game is a frozen test scenario (no AI, no turn timer). */
  debugScenario: DebugScenario | null;
  /** Bumped on each debug launch so GameScreen remounts clean. */
  debugSessionKey: number;
  /** Timestamp of the last applied move; used to reset the turn timer. */
  lastMoveAt: number;
  /** Bumped whenever the human's stake should be (visually) committed to the pot. */
  pot: number;
  buyIn: number;

  setNumPlayers: (n: number) => void;
  setVariant: (variant: GameVariant) => void;
  setThrowInScope: (scope: ThrowInScope) => void;
  startGame: (n?: number) => void;
  startBeatTransferDebug: () => void;
  goHome: () => void;
  submitHuman: (move: Move) => void;
  autoPlayHuman: () => void;
}

// AI scheduling lives outside the store so overlapping loops can be cancelled.
let aiTimer: ReturnType<typeof setTimeout> | null = null;

function cancelAi() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
}

export const useGameStore = create<GameStore>((set, get) => {
  function afterApply(next: GameState) {
    if (get().debugScenario) {
      set({ game: next, lastMoveAt: Date.now() });
      return;
    }
    if (next.phase === "gameOver") {
      cancelAi();
      set({ game: next, lastMoveAt: Date.now(), screen: "result" });
      return;
    }
    set({ game: next, lastMoveAt: Date.now() });
    scheduleAi();
  }

  function scheduleAi() {
    cancelAi();
    aiTimer = setTimeout(() => {
      aiTimer = null;
      const { game, humanId } = get();
      if (!game || game.phase !== "playing") return;

      for (const p of game.players) {
        if (p === humanId) continue;
        const move = pickMove(game, p);
        if (move) {
          afterApply(applyMove(game, move));
          return;
        }
      }
      // No AI can act -> it is the human's turn; wait for input.
    }, timing.aiMoveDelayMs);
  }

  return {
    screen: "home",
    numPlayers: 2,
    variant: "podkidnoy",
    throwInScope: "all",
    humanId: HUMAN_ID,
    names: { [HUMAN_ID]: "You" },
    game: null,
    debugScenario: null,
    debugSessionKey: 0,
    lastMoveAt: 0,
    pot: 0,
    buyIn: 100,

    setNumPlayers: (n) => set({ numPlayers: Math.min(4, Math.max(2, n)) }),
    setVariant: (variant) => set({ variant }),
    setThrowInScope: (throwInScope) => set({ throwInScope }),

    startGame: (n) => {
      cancelAi();
      const count = n ?? get().numPlayers;
      const { variant, throwInScope } = get();
      const { ids, names } = buildPlayers(count);
      const game = createGame(ids, {
        seed: (Math.random() * 2 ** 32) >>> 0,
        rules: { variant, throwInScope },
      });
      set({
        screen: "game",
        numPlayers: count,
        names,
        game,
        lastMoveAt: Date.now(),
        pot: get().buyIn * count,
      });
      scheduleAi();
    },

    startBeatTransferDebug: () => {
      cancelAi();
      const { names } = buildPlayers(3);
      set({
        screen: "game",
        numPlayers: 3,
        variant: "perevodnoy",
        throwInScope: "all",
        names,
        game: createBeatTransferDebugState(),
        debugScenario: "beatTransfer",
        debugSessionKey: get().debugSessionKey + 1,
        lastMoveAt: Date.now(),
        pot: get().buyIn * 3,
      });
    },

    goHome: () => {
      cancelAi();
      set({ screen: "home", game: null, debugScenario: null });
    },

    submitHuman: (move) => {
      const { game } = get();
      if (!game || game.phase !== "playing") return;
      try {
        afterApply(applyMove(game, move));
      } catch {
        // Illegal move (e.g. stale UI). Ignore and let the user try again.
      }
    },

    autoPlayHuman: () => {
      const { game, humanId } = get();
      if (!game || game.phase !== "playing") return;
      const move = safeMoveFor(game, humanId);
      if (move) {
        try {
          afterApply(applyMove(game, move));
        } catch {
          /* ignore */
        }
      }
    },
  };
});
