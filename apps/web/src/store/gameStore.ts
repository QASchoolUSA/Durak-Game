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
  MATCH_BUY_IN,
  matchPot,
  canPass,
  canTake,
  legalAttacks,
} from "@durak/game-core";
import { storage, MAX_DISPLAY_NAME_LENGTH } from "./storage";
import { type AppearanceId } from "../theme/appearanceThemes";

import { submitOnlineMove, submitOnlineReturn, submitUpdateDisplayName } from "./onlineBridge";

export type Screen = "welcome" | "home" | "lobby" | "game" | "result";
export type Difficulty = "easy" | "medium" | "hard";
export type PlayMode = "solo" | "online";

const RETURN_WINDOW_MS = 3000;
const RESULT_DELAY_MS = 700;
const HUMAN_ID: PlayerId = "you";
const BOT_NAMES = ["Olga", "Ivan", "Dmitri", "Maria", "Sergey"];

function buildPlayers(
  n: number,
  humanName: string,
): { ids: PlayerId[]; names: Record<PlayerId, string> } {
  const ids: PlayerId[] = [HUMAN_ID];
  const names: Record<PlayerId, string> = {
    [HUMAN_ID]: humanName.trim() || "Player",
  };
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

function playAudioSound(name: string) {
  // Simple HTML5 audio fallback or console log stub
  console.log(`[Sound] Playing: ${name}`);
}

function triggerHaptics(name: string) {
  // Web Vibration API fallback or stub
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    if (name === "error") navigator.vibrate(100);
    else if (name === "cardPlay") navigator.vibrate(20);
  }
}

export function timeoutMoveFor(state: GameState, player: PlayerId): Move | null {
  if (state.phase !== "playing") return null;
  if (canTake(state, player)) return { type: "TAKE", player };
  if (canPass(state, player)) return { type: "PASS", player };

  if (player === state.attackerId && state.table.length === 0) {
    const legal = legalAttacks(state, player);
    if (legal.length > 0) {
      const card = legal.slice().sort((a, b) => a.rank - b.rank)[0]!;
      return { type: "ATTACK", player, card };
    }
  }
  return null;
}

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
  onboarded: boolean;
  onboardedHydrated: boolean;
  cardDesign: AppearanceId;
  
  initializeStore: () => void;
  setOnboarded: (value: boolean) => void;
  openHome: () => void;
  setPlayMode: (mode: PlayMode) => void;
  setCardDesign: (id: AppearanceId) => void;

  setNumPlayers: (n: number) => void;
  setVariant: (variant: GameVariant) => void;
  setThrowInScope: (scope: ThrowInScope) => void;
  setPlayStyle: (style: PlayStyle) => void;
  setDifficulty: (d: Difficulty) => void;
  setBuyIn: (buyIn: number) => void;
  applyTurnTimerMidGame: (seconds: number) => void;
  setOnlineDisplayName: (name: string) => void;
  adoptHandleDisplayName: (handle: string) => void;
  enterOnlineLobby: (args: {
    roomId: string;
    displayName: string;
    code: string;
    isHost: boolean;
  }) => void;
  syncOnlineState: (view: any) => void;
  triggerLocalReaction: (emoji: string) => void;
  tryConsumeReactionAt: (at: number) => boolean;
  setSubmittingMove: (submitting: boolean) => void;
  clearPendingReveal: () => void;
  startGame: (n?: number, options?: { buyInCharged?: boolean }) => void;
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

let aiTimer: any = null;
let returnTimer: any = null;
let resultTimer: any = null;

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
            triggerHaptics("cardPlay");
            playAudioSound("cardPlay");
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
    names: { [HUMAN_ID]: "Player" },
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
    goldBalance: 10,
    goldHydrated: false,
    creditBalance: 1000,
    creditHydrated: false,
    onboarded: false,
    onboardedHydrated: false,
    cardDesign: "green",

    initializeStore: () => {
      const { name, isCustom } = storage.getPlayerName();
      const onboarded = storage.getOnboarded();
      const credits = storage.getCreditBalance();
      const gold = storage.getGoldBalance();
      const config = storage.getGameConfig();
      const cardDesign = storage.getCardDesign();

      set({
        onlineDisplayName: name,
        hasCustomDisplayName: isCustom,
        names: { [HUMAN_ID]: name },
        playerNameHydrated: true,
        onboarded,
        onboardedHydrated: true,
        creditBalance: credits,
        creditHydrated: true,
        goldBalance: gold,
        goldHydrated: true,
        numPlayers: config.numPlayers,
        variant: config.variant,
        throwInScope: config.throwInScope,
        playStyle: config.playStyle,
        difficulty: config.difficulty,
        cardDesign,
      });
    },

    setOnboarded: (onboarded) => {
      set({ onboarded, onboardedHydrated: true });
      storage.setOnboarded(onboarded);
    },

    openHome: () => set({ screen: "home" }),

    setPlayMode: (playMode) => set({ playMode, ...(playMode === "solo" ? { buyIn: 100 } : {}) }),

    setCardDesign: (cardDesign) => {
      set({ cardDesign });
      storage.setCardDesign(cardDesign);
    },

    setOnlineStatusMessage: (onlineStatusMessage) => set({ onlineStatusMessage }),
    clearOnlineStatusMessage: () => set({ onlineStatusMessage: null }),

    setOnlineDisplayName: (onlineDisplayName) => {
      const trimmed = onlineDisplayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
      if (!trimmed) return;
      const { humanId, names, playMode, onlineRoomId } = get();
      set({
        onlineDisplayName: trimmed,
        hasCustomDisplayName: true,
        names: { ...names, [humanId]: trimmed },
      });
      storage.setPlayerName(trimmed, true);
      if (playMode === "online" && onlineRoomId) {
        submitUpdateDisplayName(trimmed);
      }
    },

    adoptHandleDisplayName: (handle) => {
      const trimmed = handle.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
      if (!trimmed) return;
      const { humanId, names, playMode, onlineRoomId, hasCustomDisplayName } = get();
      if (hasCustomDisplayName) return;
      set({
        onlineDisplayName: trimmed,
        hasCustomDisplayName: false,
        names: { ...names, [humanId]: trimmed },
      });
      storage.setPlayerName(trimmed, false);
      if (playMode === "online" && onlineRoomId) {
        submitUpdateDisplayName(trimmed);
      }
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
      if (!view) return;
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
        buyIn: view.buyIn ?? 100,
        pot: (view.buyIn ?? 100) * view.config.numPlayers,
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
      if (yourId && !names[yourId]) {
        names[yourId] = get().onlineDisplayName.trim() || "Player";
      }

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
        
        // Trigger sounds/haptics when another player moves
        if (
          prev.lastMoveAt !== view.lastMoveAt &&
          prev.game !== null &&
          prev.screen === "game"
        ) {
          triggerHaptics("cardPlay");
          playAudioSound("cardPlay");
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
      storage.setGameConfig({
        numPlayers,
        variant: get().variant,
        throwInScope: get().throwInScope,
        playStyle: get().playStyle,
        difficulty: get().difficulty,
      });
    },
    setVariant: (variant) => {
      set({ variant });
      storage.setGameConfig({
        numPlayers: get().numPlayers,
        variant,
        throwInScope: get().throwInScope,
        playStyle: get().playStyle,
        difficulty: get().difficulty,
      });
    },
    setThrowInScope: (throwInScope) => {
      set({ throwInScope });
      storage.setGameConfig({
        numPlayers: get().numPlayers,
        variant: get().variant,
        throwInScope,
        playStyle: get().playStyle,
        difficulty: get().difficulty,
      });
    },
    setPlayStyle: (playStyle) => {
      set({ playStyle });
      storage.setGameConfig({
        numPlayers: get().numPlayers,
        variant: get().variant,
        throwInScope: get().throwInScope,
        playStyle,
        difficulty: get().difficulty,
      });
    },
    setDifficulty: (difficulty) => {
      set({ difficulty });
      storage.setGameConfig({
        numPlayers: get().numPlayers,
        variant: get().variant,
        throwInScope: get().throwInScope,
        playStyle: get().playStyle,
        difficulty,
      });
    },
    setBuyIn: (buyIn) => {
      set({ buyIn });
    },

    applyTurnTimerMidGame: (seconds) => {
      set({ turnTimerSeconds: seconds });
      const { screen, game, playMode } = get();
      if (screen === "game" && playMode === "solo" && game?.phase === "playing") {
        set({ lastMoveAt: Date.now() });
      }
    },

    startGame: (n, options) => {
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
      const count = n ?? get().numPlayers;
      const buyIn = get().playMode === "solo" ? 100 : get().buyIn;
      const buyInCharged = options?.buyInCharged === true;
      if (!buyInCharged && !get().deductCreditsLocal(buyIn)) {
        set({ onlineStatusMessage: "Not enough credits." });
        return;
      }
      const { variant, throwInScope, playStyle } = get();
      const humanName = get().onlineDisplayName.trim() || "Player";
      const { ids, names } = buildPlayers(count, humanName);
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
      storage.setGameConfig({
        numPlayers: count,
        variant,
        throwInScope,
        playStyle,
        difficulty: get().difficulty,
      });
      scheduleAi();
    },

    goHome: () => {
      cancelAi();
      clearReturnWindow();
      cancelResultTimer();
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
        names: { [HUMAN_ID]: get().onlineDisplayName.trim() || "Player" },
      });
    },

    submitHuman: (move) => {
      const { game, humanId, playMode } = get();
      if (!game || game.phase !== "playing") return;

      if (playMode === "online") {
        triggerHaptics("cardPlay");
        set({ submittingMove: true });
        submitOnlineMove(move);
        return;
      }

      const cardPlay = isHumanCardMove(move, humanId);
      const snapshot = cardPlay ? cloneGameState(game) : null;

      try {
        const next = applyMove(game, move);
        cancelReturnTimer();

        if (move.type === "TAKE") {
          triggerHaptics("takeCards");
          playAudioSound("takeCards");
        } else if (move.type === "PASS") {
          triggerHaptics("confirm");
          playAudioSound("confirm");
        } else if (isHumanCardMove(move, humanId)) {
          triggerHaptics("cardPlay");
          playAudioSound("cardPlay");
        }

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
        triggerHaptics("error");
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
      storage.setGoldBalance(safe);
    },

    trySpendGold: (amount) => {
      const cost = Math.max(0, Math.floor(amount));
      const { goldBalance } = get();
      if (cost > 0 && goldBalance < cost) return false;
      const next = goldBalance - cost;
      set({ goldBalance: next });
      storage.setGoldBalance(next);
      return true;
    },

    rollbackGoldSpend: (amount) => {
      const refund = Math.max(0, Math.floor(amount));
      if (refund <= 0) return;
      const next = get().goldBalance + refund;
      set({ goldBalance: next });
      storage.setGoldBalance(next);
    },

    awardGoldLocal: (amount) => {
      const bonus = Math.max(0, Math.floor(amount));
      if (bonus <= 0) return;
      const next = get().goldBalance + bonus;
      set({ goldBalance: next });
      storage.setGoldBalance(next);
    },

    syncCreditBalance: (balance) => {
      const safe = Math.max(0, Math.floor(balance));
      set({ creditBalance: safe, creditHydrated: true });
      storage.setCreditBalance(safe);
    },

    deductCreditsLocal: (amount) => {
      const cost = Math.max(0, Math.floor(amount));
      const { creditBalance } = get();
      if (cost > 0 && creditBalance < cost) return false;
      const next = creditBalance - cost;
      set({ creditBalance: next });
      storage.setCreditBalance(next);
      return true;
    },

    awardCreditsLocal: (amount) => {
      const bonus = Math.max(0, Math.floor(amount));
      if (bonus <= 0) return;
      const next = get().creditBalance + bonus;
      set({ creditBalance: next });
      storage.setCreditBalance(next);
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
