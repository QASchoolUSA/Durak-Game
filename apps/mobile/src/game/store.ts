import { create } from "zustand";
import {
  type GameState,
  type GameVariant,
  type Move,
  type PlayStyle,
  type PlayerId,
  type ThrowInScope,
  type Card,
  applyMove,
  canTransfer,
  cloneGameState,
  createGame,
  pickMove,
  undefendedCount,
  aiMoveDelayMs,
} from "@durak/game-core";
import { timeoutMoveFor } from "./autoMove";
import { soloMatchEndCreditDelta } from "./matchSettlement";
import { trigger } from "../feedback/haptics";
import { submitOnlineMove } from "./onlineBridge";
import type { RoomView } from "./onlineTypes";
import { gameplayFingerprint, namesEqual } from "./gameStateCompare";
import { clearPlaySession } from "./onlineSessionStorage";
import {
  getStoredGameConfig,
  setStoredGameConfig,
  type StoredGameConfig,
} from "./gameConfigStorage";
import { STARTING_CREDITS } from "./creditEconomy";
import {
  getStoredCreditBalance,
  setStoredCreditBalance,
} from "./creditStorage";
import { STARTING_GOLD } from "./goldEconomy";
import {
  getStoredGoldBalance,
  setStoredGoldBalance,
} from "./goldStorage";
import { submitOnlineReturn } from "./onlineBridge";
import {
  generateGuestDisplayName,
  getStoredNameIsCustom,
  getStoredPlayerName,
  setStoredCustomName,
  setStoredGuestName,
} from "./playerNameStorage";
import { getDevScenario, type DevScenarioId } from "../dev/debugScenarios";

export type Screen = "home" | "lobby" | "game" | "result";
export type Difficulty = "easy" | "medium" | "hard";
export type PlayMode = "solo" | "online";

const RETURN_WINDOW_MS = 3000;
const RESULT_DELAY_MS = 700;

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
  onlineDisplayName: string;
  playerNameHydrated: boolean;
  hasCustomDisplayName: boolean;
  onlineRoomCode: string | null;
  onlineIsHost: boolean;
  turnDeadlineAt: number | null;
  turnClockPlayerId: string | null;
  turnTimerSeconds: number;
  onlineStatusMessage: string | null;
  remoteReaction: { emoji: string; fromPlayerId: string; at: number } | null;
  localReaction: { emoji: string; fromPlayerId: string; at: number } | null;
  lastConsumedReactionAt: number;
  pendingReveal: { card: Card; expiresAt: number } | null;
  submittingMove: boolean;
  goldBalance: number;
  goldHydrated: boolean;
  creditBalance: number;
  creditHydrated: boolean;
  setPlayMode: (mode: PlayMode) => void;
  setNumPlayers: (n: number) => void;
  setVariant: (variant: GameVariant) => void;
  setThrowInScope: (scope: ThrowInScope) => void;
  setPlayStyle: (style: PlayStyle) => void;
  setDifficulty: (d: Difficulty) => void;
  setOnlineDisplayName: (name: string) => void;
  enterOnlineLobby: (args: {
    roomId: string;
    displayName: string;
    code: string;
    isHost: boolean;
  }) => void;
  syncOnlineState: (view: RoomView) => void;
  triggerLocalReaction: (emoji: string) => void;
  tryConsumeReactionAt: (at: number) => boolean;
  setSubmittingMove: (submitting: boolean) => void;
  clearPendingReveal: () => void;
  startGame: (n?: number) => void;
  loadDevScenario: (id: DevScenarioId) => void;
  goHome: () => void;
  setOnlineStatusMessage: (message: string | null) => void;
  clearOnlineStatusMessage: () => void;
  submitHuman: (move: Move) => void;
  autoPlayHuman: () => void;
  returnLastCard: () => void;
  clearReturnWindow: () => void;
  pauseForOverlay: () => void;
  resumeFromOverlay: () => void;
  syncGoldBalance: (balance: number) => void;
  trySpendGold: (amount: number) => boolean;
  rollbackGoldSpend: (amount: number) => void;
  awardGoldLocal: (amount: number) => void;
  syncCreditBalance: (balance: number) => void;
  deductCreditsLocal: (amount: number) => boolean;
  awardCreditsLocal: (amount: number) => void;
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

  function settleSoloEconomy(next: GameState) {
    if (get().playMode !== "solo") return;
    const { humanId, buyIn, numPlayers } = get();
    const delta = soloMatchEndCreditDelta({
      isDraw: next.loserId === null,
      humanIsWinner: (next.finishedOrder[0] ?? null) === humanId,
      numPlayers,
      buyIn,
    });
    if (delta > 0) {
      get().awardCreditsLocal(delta);
    }
  }

  function finishGameOver(next: GameState) {
    cancelAi();
    cancelResultTimer();
    settleSoloEconomy(next);
    set({
      game: next,
      lastMoveAt: Date.now(),
      returnSnapshot: null,
      returnExpiresAt: 0,
    });
    resultTimer = setTimeout(() => {
      resultTimer = null;
      set({ screen: "result" });
    }, RESULT_DELAY_MS);
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
    }, aiMoveDelayMs(get().difficulty));
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
    onlineDisplayName: "Player",
    playerNameHydrated: false,
    hasCustomDisplayName: false,
    onlineRoomCode: null,
    onlineIsHost: false,
    turnDeadlineAt: null,
    turnClockPlayerId: null,
    turnTimerSeconds: 12,
    onlineStatusMessage: null,
    remoteReaction: null,
    localReaction: null,
    lastConsumedReactionAt: 0,
    pendingReveal: null,
    submittingMove: false,
    goldBalance: STARTING_GOLD,
    goldHydrated: false,
    creditBalance: STARTING_CREDITS,
    creditHydrated: false,

    setPlayMode: (playMode) => set({ playMode }),

    setOnlineStatusMessage: (onlineStatusMessage) => set({ onlineStatusMessage }),
    clearOnlineStatusMessage: () => set({ onlineStatusMessage: null }),

    setOnlineDisplayName: (onlineDisplayName) => {
      const trimmed = onlineDisplayName.trim().slice(0, 20);
      if (!trimmed) return;
      set({ onlineDisplayName: trimmed, hasCustomDisplayName: true });
      void setStoredCustomName(trimmed);
    },

    setSubmittingMove: (submittingMove) => set({ submittingMove }),
    clearPendingReveal: () => set({ pendingReveal: null }),

    triggerLocalReaction: (emoji) => {
      const { humanId } = get();
      const at = Date.now();
      set({
        localReaction: {
          emoji: emoji.slice(0, 8),
          fromPlayerId: humanId,
          at,
        },
      });
    },

    tryConsumeReactionAt: (at) => {
      const { lastConsumedReactionAt } = get();
      if (at <= lastConsumedReactionAt) return false;
      set({ lastConsumedReactionAt: at });
      return true;
    },

    enterOnlineLobby: ({ roomId, displayName, code, isHost }) => {
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
      set({
        playMode: "online",
        onlineRoomId: roomId,
        onlineDisplayName: displayName,
        onlineRoomCode: code,
        onlineIsHost: isHost,
        screen: "lobby",
        game: null,
        pendingReveal: null,
        submittingMove: false,
      });
    },

    syncOnlineState: (view) => {
      const prev = get();
      const nextPendingReveal = view.pendingReveal ?? null;

      const baseWithoutPlayer = {
        onlineRoomCode: view.code,
        onlineIsHost: view.isHost,
        numPlayers: view.config.numPlayers,
        variant: view.config.variant,
        throwInScope: view.config.throwInScope,
        playStyle: view.config.playStyle,
        difficulty: view.config.difficulty,
        lastMoveAt: view.lastMoveAt,
        turnDeadlineAt: view.turnDeadlineAt,
        turnClockPlayerId: view.turnClockPlayerId,
        turnTimerSeconds: view.turnTimerSeconds,
        pot: prev.buyIn * view.config.numPlayers,
        pendingReveal: nextPendingReveal,
        submittingMove: false,
        ...(view.recentReaction && view.recentReaction.at !== prev.remoteReaction?.at
          ? { remoteReaction: view.recentReaction }
          : {}),
        returnExpiresAt: view.returnExpiresAt ?? 0,
        ...(view.returnExpiresAt
          ? {}
          : { returnSnapshot: null, returnExpiresAt: 0 }),
      };

      if (view.status === "lobby") {
        const lobbyNames: Record<PlayerId, string> = {};
        for (const m of view.members) {
          lobbyNames[`seat-${m.seatIndex}`] = m.displayName;
        }
        set({
          ...baseWithoutPlayer,
          screen: "lobby",
          game: null,
          names: lobbyNames,
          pendingReveal: null,
        });
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
        const nextGame = view.gameState;
        const rematchFromResult = prev.screen === "result";
        if (rematchFromResult) {
          cancelResultTimer();
        }
        const reactionChanged =
          Boolean(view.recentReaction) &&
          view.recentReaction?.at !== prev.remoteReaction?.at;
        const returnChanged = (view.returnExpiresAt ?? 0) !== prev.returnExpiresAt;
        const pendingRevealChanged =
          (prev.pendingReveal?.expiresAt ?? 0) !== (nextPendingReveal?.expiresAt ?? 0) ||
          (prev.pendingReveal?.card.id ?? null) !== (nextPendingReveal?.card.id ?? null);
        const sameGameplay =
          !rematchFromResult &&
          prev.game != null &&
          prev.screen === "game" &&
          prev.humanId === yourId &&
          gameplayFingerprint(prev.game, yourId) ===
            gameplayFingerprint(nextGame, yourId);
        const sameMeta =
          prev.lastMoveAt === view.lastMoveAt &&
          prev.turnDeadlineAt === view.turnDeadlineAt &&
          prev.turnClockPlayerId === view.turnClockPlayerId &&
          namesEqual(prev.names, names) &&
          !returnChanged &&
          !reactionChanged &&
          !pendingRevealChanged;

        if (sameGameplay && sameMeta) {
          return;
        }

        set({
          ...base,
          playMode: "online",
          screen: "game",
          game: nextGame,
          pendingReveal: null,
          submittingMove: false,
        });
        return;
      }

      if (view.status === "finished" && view.gameState) {
        if (view.gameState.phase === "gameOver") {
          set({
            ...base,
            playMode: "online",
            game: view.gameState,
            pendingReveal: null,
            submittingMove: false,
            ...(prev.screen === "result" ? { screen: "result" as const } : { screen: "game" as const }),
          });
          if (prev.screen !== "result") {
            cancelResultTimer();
            resultTimer = setTimeout(() => {
              resultTimer = null;
              set({ screen: "result" });
            }, RESULT_DELAY_MS);
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
      const buyIn = get().buyIn;
      if (!get().deductCreditsLocal(buyIn)) {
        set({ onlineStatusMessage: "Not enough credits." });
        return;
      }
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
        pot: buyIn * count,
        onlineRoomId: null,
        onlineRoomCode: null,
        onlineStatusMessage: null,
      });
      persistConfig(get());
      scheduleAi();
    },

    loadDevScenario: (id) => {
      if (!__DEV__) return;
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
      const scenario = getDevScenario(id).build();
      const buyIn = get().buyIn;
      set({
        playMode: "solo",
        screen: "game",
        game: scenario.game,
        names: scenario.names,
        humanId: HUMAN_ID,
        numPlayers: scenario.numPlayers,
        lastMoveAt: Date.now(),
        pot: buyIn * scenario.numPlayers,
        onlineRoomId: null,
        onlineRoomCode: null,
        onlineIsHost: false,
        onlineStatusMessage: null,
        submittingMove: false,
        pendingReveal: null,
        returnSnapshot: null,
        returnExpiresAt: 0,
        turnDeadlineAt: null,
        turnClockPlayerId: null,
      });
      scheduleAi();
    },

    goHome: () => {
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
      void clearPlaySession();
      set({
        screen: "home",
        game: null,
        playMode: "solo",
        onlineRoomId: null,
        onlineRoomCode: null,
        onlineIsHost: false,
        turnDeadlineAt: null,
        turnClockPlayerId: null,
        onlineStatusMessage: null,
        remoteReaction: null,
        localReaction: null,
        lastConsumedReactionAt: 0,
        pendingReveal: null,
        submittingMove: false,
        pot: 0,
        humanId: HUMAN_ID,
        names: { [HUMAN_ID]: "You" },
      });
    },

    submitHuman: (move) => {
      const { game, humanId, playStyle, playMode } = get();
      if (!game || game.phase !== "playing") return;

      if (playMode === "online") {
        triggerMoveFeedback(move);
        set({ submittingMove: true });
        submitOnlineMove(move);
        return;
      }

      const cardPlay = isHumanCardMove(move, humanId);
      const snapshot = cardPlay ? cloneGameState(game) : null;

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

        if (cardPlay && snapshot) {
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
      const { game, humanId, playMode } = get();
      if (playMode === "online") return;
      if (!game || game.phase !== "playing") return;
      const move = timeoutMoveFor(game, humanId);
      if (move) {
        get().submitHuman(move);
      }
    },

    returnLastCard: () => {
      const { returnSnapshot, returnExpiresAt, playMode } = get();
      if (playMode === "online") {
        if (!returnExpiresAt || Date.now() > returnExpiresAt) return;
        set({ submittingMove: true });
        submitOnlineReturn();
        return;
      }
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

    syncGoldBalance: (balance) => {
      const safe = Math.max(0, Math.floor(balance));
      set({ goldBalance: safe, goldHydrated: true });
      void setStoredGoldBalance(safe);
    },

    trySpendGold: (amount) => {
      const cost = Math.max(0, Math.floor(amount));
      const { goldBalance } = get();
      if (cost > 0 && goldBalance < cost) return false;
      const next = goldBalance - cost;
      set({ goldBalance: next });
      void setStoredGoldBalance(next);
      return true;
    },

    rollbackGoldSpend: (amount) => {
      const refund = Math.max(0, Math.floor(amount));
      if (refund <= 0) return;
      const next = get().goldBalance + refund;
      set({ goldBalance: next });
      void setStoredGoldBalance(next);
    },

    awardGoldLocal: (amount) => {
      const bonus = Math.max(0, Math.floor(amount));
      if (bonus <= 0) return;
      const next = get().goldBalance + bonus;
      set({ goldBalance: next });
      void setStoredGoldBalance(next);
    },

    syncCreditBalance: (balance) => {
      const safe = Math.max(0, Math.floor(balance));
      set({ creditBalance: safe, creditHydrated: true });
      void setStoredCreditBalance(safe);
    },

    deductCreditsLocal: (amount) => {
      const cost = Math.max(0, Math.floor(amount));
      const { creditBalance } = get();
      if (cost > 0 && creditBalance < cost) return false;
      const next = creditBalance - cost;
      set({ creditBalance: next });
      void setStoredCreditBalance(next);
      return true;
    },

    awardCreditsLocal: (amount) => {
      const bonus = Math.max(0, Math.floor(amount));
      if (bonus <= 0) return;
      const next = get().creditBalance + bonus;
      set({ creditBalance: next });
      void setStoredCreditBalance(next);
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
      const isCustom = await getStoredNameIsCustom();
      useGameStore.setState({
        onlineDisplayName: stored,
        hasCustomDisplayName: isCustom,
        playerNameHydrated: true,
      });
      return;
    }
    const guest = generateGuestDisplayName();
    await setStoredGuestName(guest);
    useGameStore.setState({
      onlineDisplayName: guest,
      hasCustomDisplayName: false,
      playerNameHydrated: true,
    });
  } catch {
    useGameStore.setState({ playerNameHydrated: true });
  }
}

export type { StoredGameConfig };


export async function loadGold(): Promise<void> {
  try {
    const balance = await getStoredGoldBalance();
    useGameStore.setState({ goldBalance: balance, goldHydrated: true });
  } catch {
    useGameStore.setState({ goldHydrated: true });
  }
}

export async function loadCredits(): Promise<void> {
  try {
    const balance = await getStoredCreditBalance();
    useGameStore.setState({ creditBalance: balance, creditHydrated: true });
  } catch {
    useGameStore.setState({ creditHydrated: true });
  }
}

