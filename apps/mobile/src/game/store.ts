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
import { submitOnlineMove } from "./onlineBridge";
import type { RoomView } from "./onlineTypes";
import { clearRoomSession } from "./onlineSessionStorage";
import {
  getStoredGameConfig,
  setStoredGameConfig,
  type StoredGameConfig,
} from "./gameConfigStorage";
import {
  getStoredPlayerName,
  setStoredPlayerName,
} from "./playerNameStorage";

export type Screen = "home" | "lobby" | "game" | "result";
export type Difficulty = "easy" | "medium" | "hard";
export type PlayMode = "solo" | "online";

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
  playMode: PlayMode;
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
  onlineRoomId: string | null;
  onlineSessionToken: string | null;
  onlineDisplayName: string;
  playerNameHydrated: boolean;
  hasSavedPlayerName: boolean;
  onlineRoomCode: string | null;
  onlineIsHost: boolean;
  setPlayMode: (mode: PlayMode) => void;
  setNumPlayers: (n: number) => void;
  setVariant: (variant: GameVariant) => void;
  setThrowInScope: (scope: ThrowInScope) => void;
  setPlayStyle: (style: PlayStyle) => void;
  setDifficulty: (d: Difficulty) => void;
  setOnlineDisplayName: (name: string) => void;
  enterOnlineLobby: (args: {
    roomId: string;
    sessionToken: string;
    displayName: string;
    code: string;
    isHost: boolean;
  }) => void;
  syncOnlineState: (view: RoomView) => void;
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
    if (get().playMode === "solo") {
      scheduleAi();
    }
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
    if (get().playMode !== "solo") return;
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
    playMode: "solo",
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
    onlineRoomId: null,
    onlineSessionToken: null,
    onlineDisplayName: "Player",
    playerNameHydrated: false,
    hasSavedPlayerName: false,
    onlineRoomCode: null,
    onlineIsHost: false,

    setPlayMode: (playMode) => set({ playMode }),

    setOnlineDisplayName: (onlineDisplayName) => {
      const trimmed = onlineDisplayName.trim().slice(0, 20);
      if (!trimmed) return;
      set({ onlineDisplayName: trimmed, hasSavedPlayerName: true });
      void setStoredPlayerName(trimmed);
    },

    enterOnlineLobby: ({ roomId, sessionToken, displayName, code, isHost }) => {
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
      set({
        playMode: "online",
        onlineRoomId: roomId,
        onlineSessionToken: sessionToken,
        onlineDisplayName: displayName,
        onlineRoomCode: code,
        onlineIsHost: isHost,
        screen: "lobby",
        game: null,
      });
    },

    syncOnlineState: (view) => {
      const prev = get();

      const baseWithoutPlayer = {
        onlineRoomCode: view.code,
        onlineIsHost: view.isHost,
        numPlayers: view.config.numPlayers,
        variant: view.config.variant,
        throwInScope: view.config.throwInScope,
        playStyle: view.config.playStyle,
        difficulty: view.config.difficulty,
        lastMoveAt: view.lastMoveAt,
        pot: prev.buyIn * view.config.numPlayers,
      };

      if (view.status === "lobby") {
        const lobbyNames: Record<PlayerId, string> = {};
        for (const m of view.members) {
          lobbyNames[`seat-${m.seatIndex}`] = m.displayName;
        }
        set({ ...baseWithoutPlayer, screen: "lobby", game: null, names: lobbyNames });
        return;
      }

      const yourId = view.yourPlayerId;
      if (!yourId) return;

      const names = { ...view.names };
      names[yourId] = "You";

      const base = {
        ...baseWithoutPlayer,
        names,
        humanId: yourId,
      };

      if (view.status === "playing" && view.gameState) {
        set({ ...base, screen: "game", game: view.gameState });
        return;
      }

      if (view.status === "finished" && view.gameState) {
        if (view.gameState.phase === "gameOver") {
          const delay = view.gameState.table.length === 0 ? RESULT_DELAY_MS : 0;
          set({
            ...base,
            game: view.gameState,
            ...(delay === 0 ? { screen: "result" as const } : { screen: "game" as const }),
          });
          if (delay > 0 && prev.screen !== "result") {
            cancelResultTimer();
            resultTimer = setTimeout(() => {
              resultTimer = null;
              set({ screen: "result" });
            }, delay);
          }
        }
      }
    },

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
        playMode: "solo",
        screen: "game",
        numPlayers: count,
        names,
        game,
        lastMoveAt: Date.now(),
        pot: get().buyIn * count,
        onlineRoomId: null,
        onlineSessionToken: null,
        onlineRoomCode: null,
      });
      persistConfig(get());
      scheduleAi();
    },

    goHome: () => {
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
      void clearRoomSession();
      set({
        screen: "home",
        game: null,
        playMode: "solo",
        onlineRoomId: null,
        onlineSessionToken: null,
        onlineRoomCode: null,
        onlineIsHost: false,
        humanId: HUMAN_ID,
        names: { [HUMAN_ID]: "You" },
      });
    },

    submitHuman: (move) => {
      const { game, humanId, playStyle, playMode } = get();
      if (!game || game.phase !== "playing") return;

      if (playMode === "online") {
        triggerMoveFeedback(move);
        submitOnlineMove(move);
        return;
      }

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
      const { returnSnapshot, returnExpiresAt, playMode } = get();
      if (playMode === "online") return;
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
      const { game, playMode } = get();
      if (game?.phase === "playing" && playMode === "solo") {
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

export async function loadPlayerName(): Promise<void> {
  try {
    const stored = await getStoredPlayerName();
    if (stored) {
      useGameStore.setState({
        onlineDisplayName: stored,
        hasSavedPlayerName: true,
        playerNameHydrated: true,
      });
      return;
    }
    useGameStore.setState({
      hasSavedPlayerName: false,
      playerNameHydrated: true,
    });
  } catch {
    useGameStore.setState({ playerNameHydrated: true });
  }
}

export type { StoredGameConfig };
