import { create } from "zustand";
import {
  type GameState,
  type GameVariant,
  type Move,
  type PlayStyle,
  type PlayerId,
  type ThrowInScope,
  applyMove,
  canTransfer,
  cloneGameState,
  createGame,
  pickMove,
  undefendedCount,
} from "@durak/game-core";
import { timeoutMoveFor } from "./autoMove";
import { trigger } from "../feedback/haptics";
import {
  getStoredGameConfig,
  setStoredGameConfig,
  type StoredGameConfig,
} from "./gameConfigStorage";

export type Screen = "home" | "game" | "result";
export type Difficulty = "easy" | "medium" | "hard";

const AI_DELAY: Record<Difficulty, number> = { easy: 1400, medium: 750, hard: 320 };
const RETURN_WINDOW_MS = 3000;
const RESULT_DELAY_MS = 400;

const HUMAN_ID: PlayerId = "you";
const BOT_NAMES = ["Olga", "Ivan", "Dmitri", "Maria", "Sergey"];

function persistConfig(state: Pick<GameStore, "numPlayers" | "variant" | "throwInScope" | "playStyle" | "difficulty">) {
  void setStoredGameConfig({
    numPlayers: state.numPlayers,
    variant: state.variant,
    throwInScope: state.throwInScope,
    playStyle: state.playStyle,
    difficulty: state.difficulty,
  });
}

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

function isHumanCardMove(move: Move, humanId: PlayerId): boolean {
  return (
    move.player === humanId &&
    (move.type === "ATTACK" || move.type === "DEFEND" || move.type === "TRANSFER")
  );
}

function triggerMoveFeedback(move: Move): void {
  if (move.type === "TAKE") trigger("takeCards");
  else if (move.type === "PASS") trigger("confirm");
  else if (move.type === "ATTACK" || move.type === "DEFEND" || move.type === "TRANSFER") {
    trigger("cardPlay");
  }
}

interface GameStore {
  screen: Screen;
  numPlayers: number;
  variant: GameVariant;
  throwInScope: ThrowInScope;
  playStyle: PlayStyle;
  humanId: PlayerId;
  names: Record<PlayerId, string>;
  game: GameState | null;
  lastMoveAt: number;
  returnSnapshot: GameState | null;
  returnExpiresAt: number;
  pot: number;
  buyIn: number;
  difficulty: Difficulty;
  setNumPlayers: (n: number) => void;
  setVariant: (variant: GameVariant) => void;
  setThrowInScope: (scope: ThrowInScope) => void;
  setPlayStyle: (style: PlayStyle) => void;
  setDifficulty: (d: Difficulty) => void;
  startGame: (n?: number) => void;
  goHome: () => void;
  submitHuman: (move: Move) => void;
  autoPlayHuman: () => void;
  returnLastCard: () => void;
  clearReturnWindow: () => void;
  pauseForOverlay: () => void;
  resumeFromOverlay: () => void;
}

let aiTimer: ReturnType<typeof setTimeout> | null = null;
let returnTimer: ReturnType<typeof setTimeout> | null = null;
let resultTimer: ReturnType<typeof setTimeout> | null = null;

function cancelAi() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
}

function cancelReturnTimer() {
  if (returnTimer) {
    clearTimeout(returnTimer);
    returnTimer = null;
  }
}

function cancelResultTimer() {
  if (resultTimer) {
    clearTimeout(resultTimer);
    resultTimer = null;
  }
}

export const useGameStore = create<GameStore>((set, get) => {
  function clearReturnWindow() {
    cancelReturnTimer();
    set({ returnSnapshot: null, returnExpiresAt: 0 });
  }

  function finishGameOver(next: GameState) {
    cancelAi();
    cancelResultTimer();
    const delay = next.table.length === 0 ? RESULT_DELAY_MS : 0;
    set({
      game: next,
      lastMoveAt: Date.now(),
      returnSnapshot: null,
      returnExpiresAt: 0,
      ...(delay === 0 ? { screen: "result" as const } : {}),
    });
    if (delay > 0) {
      resultTimer = setTimeout(() => {
        resultTimer = null;
        set({ screen: "result" });
      }, delay);
    }
  }

  function afterApply(next: GameState) {
    clearReturnWindow();

    if (next.phase === "gameOver") {
      finishGameOver(next);
      return;
    }
    set({ game: next, lastMoveAt: Date.now() });
    scheduleAi();
  }

  function scheduleAiAfterReturnWindow() {
    cancelReturnTimer();
    returnTimer = setTimeout(() => {
      returnTimer = null;
      set({ returnSnapshot: null, returnExpiresAt: 0 });
      scheduleAi();
    }, RETURN_WINDOW_MS);
  }

  function scheduleAi() {
    cancelAi();
    aiTimer = setTimeout(() => {
      aiTimer = null;
      const { game, humanId } = get();
      if (!game || game.phase !== "playing") return;

      if (
        game.rules.variant === "perevodnoy" &&
        game.defenderId === humanId &&
        !game.takeInProgress &&
        game.table.length === 1 &&
        undefendedCount(game) > 0
      ) {
        return;
      }

      if (canTransfer(game, humanId)) return;

      for (const p of game.players) {
        if (p === humanId) continue;
        const move = pickMove(game, p, get().difficulty);
        if (move) {
          try {
            const next = applyMove(game, move);
            triggerMoveFeedback(move);
            afterApply(next);
          } catch {
            /* ignore */
          }
          return;
        }
      }
    }, AI_DELAY[get().difficulty]);
  }

  return {
    screen: "home",
    numPlayers: 2,
    variant: "podkidnoy",
    throwInScope: "all",
    playStyle: "standard",
    difficulty: "medium",
    humanId: HUMAN_ID,
    names: { [HUMAN_ID]: "You" },
    game: null,
    lastMoveAt: 0,
    returnSnapshot: null,
    returnExpiresAt: 0,
    pot: 0,
    buyIn: 100,

    setNumPlayers: (n) => {
      const numPlayers = Math.min(6, Math.max(2, n));
      set({ numPlayers });
      persistConfig({ ...get(), numPlayers });
    },
    setVariant: (variant) => {
      set({ variant });
      persistConfig(get());
    },
    setThrowInScope: (throwInScope) => {
      set({ throwInScope });
      persistConfig(get());
    },
    setPlayStyle: (playStyle) => {
      set({ playStyle });
      persistConfig(get());
    },
    setDifficulty: (difficulty) => {
      set({ difficulty });
      persistConfig(get());
    },

    startGame: (n) => {
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
      const count = n ?? get().numPlayers;
      const { variant, throwInScope, playStyle } = get();
      const { ids, names } = buildPlayers(count);
      const game = createGame(ids, {
        seed: (Math.random() * 2 ** 32) >>> 0,
        rules: { variant, throwInScope, playStyle },
      });
      set({
        screen: "game",
        numPlayers: count,
        names,
        game,
        lastMoveAt: Date.now(),
        pot: get().buyIn * count,
      });
      persistConfig(get());
      scheduleAi();
    },

    goHome: () => {
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
      set({ screen: "home", game: null });
    },

    submitHuman: (move) => {
      const { game, humanId, playStyle } = get();
      if (!game || game.phase !== "playing") return;

      const abilitiesActive = game.rules.playStyle === "abilities";
      const cardPlay = isHumanCardMove(move, humanId);
      const snapshot =
        abilitiesActive && cardPlay ? cloneGameState(game) : null;

      try {
        const next = applyMove(game, move);
        cancelReturnTimer();

        if (move.type === "TAKE") trigger("takeCards");
        else if (move.type === "PASS") trigger("confirm");
        else if (isHumanCardMove(move, humanId)) trigger("cardPlay");

        if (next.phase === "gameOver") {
          finishGameOver(next);
          return;
        }

        if (abilitiesActive && cardPlay && snapshot) {
          cancelAi();
          set({
            game: next,
            lastMoveAt: Date.now(),
            returnSnapshot: snapshot,
            returnExpiresAt: Date.now() + RETURN_WINDOW_MS,
          });
          scheduleAiAfterReturnWindow();
          return;
        }

        afterApply(next);
      } catch {
        trigger("error");
        // Illegal move (e.g. stale UI). Ignore and let the user try again.
      }
    },

    autoPlayHuman: () => {
      const { game, humanId } = get();
      if (!game || game.phase !== "playing") return;
      const move = timeoutMoveFor(game, humanId);
      if (move) {
        get().submitHuman(move);
      }
    },

    returnLastCard: () => {
      const { returnSnapshot, returnExpiresAt } = get();
      if (!returnSnapshot || Date.now() > returnExpiresAt) return;

      cancelReturnTimer();
      cancelAi();
      set({
        game: returnSnapshot,
        lastMoveAt: Date.now(),
        returnSnapshot: null,
        returnExpiresAt: 0,
      });
      scheduleAi();
    },

    clearReturnWindow,

    pauseForOverlay: () => {
      cancelAi();
    },

    resumeFromOverlay: () => {
      const { game } = get();
      if (game?.phase === "playing") {
        scheduleAi();
      }
    },
  };
});

export async function loadGameConfig(): Promise<void> {
  try {
    const stored = await getStoredGameConfig();
    if (!stored) return;
    useGameStore.setState({
      numPlayers: stored.numPlayers,
      variant: stored.variant,
      throwInScope: stored.throwInScope,
      playStyle: stored.playStyle,
      difficulty: stored.difficulty,
    });
  } catch {
    // Fall through to defaults
  }
}

export type { StoredGameConfig };
