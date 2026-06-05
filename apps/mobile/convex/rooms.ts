import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import {
  applyMove,
  canTransfer,
  cloneGameState,
  createGame,
  pickMove,
  type GameState,
  type Card,
  type Move,
  type PlayerId,
} from "@durak/game-core";
import { randomBotId, randomRoomCode } from "./lib/codes";
import {
  activeHumanPlayer,
  botPlayerIds,
  DEFAULT_TURN_SECONDS,
  LOBBY_STALE_MS,
  PLAYING_STALE_MS,
  timeoutMoveFor,
} from "./lib/onlineGame";
import {
  BOT_NAMES,
  allHumansReady,
  findMember,
  humanMemberCount,
  isHost,
  lobbyHumans,
  memberAtSeat,
  nextOpenSeat,
  readyHumanCount,
  type RoomDoc,
} from "./lib/roomHelpers";
import { requireUserId } from "./lib/requireAuth";
import { onlineRules } from "./lib/onlineRules";
import { memberNames, sanitizeGameState } from "./lib/views";
import {
  deductGold,
  GRAVEYARD_GOLD_COST,
  REVEAL_GOLD_COST,
} from "./wallets";
import { pickRevealedCard } from "./lib/revealHelpers";

const AI_DELAY = { easy: 1400, medium: 750, hard: 320 } as const;
const CLEANUP_BATCH_SIZE = 100;
const RETURN_WINDOW_MS = 3000;
const REVEAL_DISPLAY_MS = 4000;

const roomConfigValidator = v.object({
  numPlayers: v.number(),
  variant: v.union(v.literal("podkidnoy"), v.literal("perevodnoy")),
  throwInScope: v.union(v.literal("all"), v.literal("neighbor")),
  playStyle: v.union(v.literal("standard"), v.literal("abilities")),
  difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
});

const moveValidator = v.object({
  type: v.union(
    v.literal("ATTACK"),
    v.literal("DEFEND"),
    v.literal("TRANSFER"),
    v.literal("TAKE"),
    v.literal("PASS"),
  ),
  player: v.string(),
  card: v.optional(
    v.object({
      suit: v.union(
        v.literal("spades"),
        v.literal("hearts"),
        v.literal("diamonds"),
        v.literal("clubs"),
      ),
      rank: v.union(
        v.literal(6),
        v.literal(7),
        v.literal(8),
        v.literal(9),
        v.literal(10),
        v.literal(11),
        v.literal(12),
        v.literal(13),
        v.literal(14),
      ),
      id: v.string(),
    }),
  ),
  target: v.optional(v.number()),
});

function isCardMove(move: Move): boolean {
  return move.type === "ATTACK" || move.type === "DEFEND" || move.type === "TRANSFER";
}

function findBotMove(
  state: GameState,
  bots: Set<string>,
  difficulty: "easy" | "medium" | "hard",
): Move | null {
  for (const p of state.players) {
    if (!bots.has(p)) continue;
    const move = pickMove(state, p, difficulty);
    if (move) return move;
  }
  return null;
}

function shouldDeferBot(state: GameState, bots: Set<string>): boolean {
  for (const p of state.players) {
    if (bots.has(p)) continue;
    if (canTransfer(state, p)) return true;
  }
  return false;
}

function touchFields(now = Date.now()) {
  return { lastMoveAt: now, lastTouchedAt: now };
}

async function applyGameUpdate(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  room: RoomDoc,
  next: GameState,
  options?: {
    returnWindow?: RoomDoc["returnWindow"];
    clearReturnWindow?: boolean;
  },
) {
  const status = next.phase === "gameOver" ? "finished" : "playing";
  const bots = botPlayerIds(room.members);
  const turnTimerSeconds = room.turnTimerSeconds ?? DEFAULT_TURN_SECONDS;
  const now = Date.now();

  let turnDeadlineAt: number | undefined = undefined;
  if (next.phase === "playing") {
    const human = activeHumanPlayer(next, bots);
    if (human) {
      turnDeadlineAt = now + turnTimerSeconds * 1000;
      await ctx.scheduler.runAfter(
        turnTimerSeconds * 1000,
        internal.rooms.processHumanTimeout,
        { roomId, expectedDeadline: turnDeadlineAt },
      );
    }
  }

  await ctx.db.patch(roomId, {
    gameState: next,
    status,
    ...touchFields(now),
    turnDeadlineAt,
    returnWindow: options?.returnWindow,
    ...(options?.clearReturnWindow !== false
      ? options?.returnWindow
        ? {}
        : { returnWindow: undefined }
      : {}),
    pendingReveal: undefined,
    version: room.version + 1,
  });

  if (next.phase === "playing") {
    await ctx.scheduler.runAfter(0, internal.rooms.processBotTurns, { roomId });
  }
}

async function removeMemberFromRoom(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  room: RoomDoc,
  userId: string,
) {
  let members = room.members.filter((m) => m.userId !== userId);
  let hostUserId = room.hostUserId;

  if (room.hostUserId === userId) {
    const nextHost = members.find((m) => !m.isBot);
    if (!nextHost) {
      await ctx.db.delete(roomId);
      return;
    }
    hostUserId = nextHost.userId;
  }

  await ctx.db.patch(roomId, {
    members,
    hostUserId,
    ...touchFields(),
    version: room.version + 1,
  });
}

export const createRoom = mutation({
  args: {
    config: roomConfigValidator,
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const numPlayers = Math.min(6, Math.max(2, args.config.numPlayers));
    const config = { ...args.config, numPlayers, playStyle: "standard" as const };
    const now = Date.now();

    let code = randomRoomCode();
    for (let attempt = 0; attempt < 8; attempt++) {
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!existing) break;
      code = randomRoomCode();
    }

    const roomId = await ctx.db.insert("rooms", {
      code,
      status: "lobby",
      hostUserId: userId,
      config,
      members: [
        {
          userId,
          displayName: args.displayName.trim() || "Host",
          seatIndex: 0,
          isBot: false,
          isReady: false,
        },
      ],
      lastMoveAt: now,
      lastTouchedAt: now,
      turnTimerSeconds: DEFAULT_TURN_SECONDS,
      version: 0,
    });

    return { roomId, code };
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
      .first();

    if (!room || room.status !== "lobby") {
      throw new Error("Room not found or game already started");
    }

    const seat = nextOpenSeat(room.members, room.config.numPlayers);
    if (seat === null) {
      throw new Error("Room is full");
    }

    const members = [
      ...room.members,
      {
        userId,
        displayName: args.displayName.trim() || "Player",
        seatIndex: seat,
        isBot: false,
        isReady: false,
      },
    ];

    await ctx.db.patch(room._id, {
      members,
      ...touchFields(),
      version: room.version + 1,
    });

    return { roomId: room._id, seatIndex: seat };
  },
});

export const leaveRoom = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    const member = findMember(room, userId);
    if (!member) return;

    if (room.status !== "lobby" && room.status !== "finished") return;

    await removeMemberFromRoom(ctx, args.roomId, room, userId);
  },
});

export const forfeit = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    const member = findMember(room, userId);
    if (!member) return;

    if (room.status === "lobby" || room.status === "finished") {
      await removeMemberFromRoom(ctx, args.roomId, room, userId);
      return;
    }

    if (room.status === "playing") {
      const members = room.members.map((m) =>
        m.userId === userId
          ? { ...m, isBot: true, displayName: `${m.displayName} (AI)` }
          : m,
      );

      await ctx.db.patch(args.roomId, {
        members,
        ...touchFields(),
        version: room.version + 1,
      });

      await ctx.scheduler.runAfter(0, internal.rooms.processBotTurns, {
        roomId: args.roomId,
      });
    }
  },
});

export const touchRoom = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;
    if (!findMember(room, userId)) return;

    await ctx.db.patch(args.roomId, { lastTouchedAt: Date.now() });
  },
});

export const sendReaction = mutation({
  args: {
    roomId: v.id("rooms"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    const member = findMember(room, userId);
    if (!member?.playerId) return;
    if (room.status !== "playing" && room.status !== "finished") return;

    const now = Date.now();
    await ctx.db.patch(args.roomId, {
      recentReaction: {
        emoji: args.emoji.slice(0, 8),
        fromPlayerId: member.playerId,
        at: now,
      },
      lastTouchedAt: now,
      version: room.version + 1,
    });
  },
});

function addBotAtSeat(
  members: { userId: string; displayName: string; seatIndex: number; isBot: boolean }[],
  seat: number,
): void {
  const botIndex = members.filter((m) => m.isBot).length;
  members.push({
    userId: randomBotId(),
    displayName: BOT_NAMES[botIndex] ?? `Bot ${botIndex + 1}`,
    seatIndex: seat,
    isBot: true,
  });
}

export const setLobbyBot = mutation({
  args: {
    roomId: v.id("rooms"),
    seatIndex: v.number(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot change AI seats outside lobby");
    }
    if (!isHost(room, userId)) {
      throw new Error("Only the host can manage AI seats");
    }
    if (args.seatIndex < 0 || args.seatIndex >= room.config.numPlayers) {
      throw new Error("Invalid seat");
    }

    let members = [...room.members];
    const atSeat = memberAtSeat(members, args.seatIndex);

    if (args.enabled) {
      if (atSeat) {
        throw new Error("Seat is not empty");
      }
      addBotAtSeat(members, args.seatIndex);
    } else {
      if (!atSeat?.isBot) {
        throw new Error("No AI at this seat");
      }
      members = members.filter(
        (m) => !(m.seatIndex === args.seatIndex && m.isBot),
      );
    }

    await ctx.db.patch(args.roomId, {
      members,
      ...touchFields(),
      version: room.version + 1,
    });
  },
});

export const setRoomDifficulty = mutation({
  args: {
    roomId: v.id("rooms"),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot change difficulty outside lobby");
    }
    if (!isHost(room, userId)) {
      throw new Error("Only the host can change AI difficulty");
    }

    await ctx.db.patch(args.roomId, {
      config: { ...room.config, difficulty: args.difficulty },
      ...touchFields(),
      version: room.version + 1,
    });
  },
});

export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
    soloWithAi: v.optional(v.boolean()),
    autoFillEmptySeats: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot start this room");
    }
    if (!isHost(room, userId)) {
      throw new Error("Only the host can start the game");
    }
    if (humanMemberCount(room.members) < 1) {
      throw new Error("Need at least one player");
    }

    const humansInRoom = humanMemberCount(room.members);
    if (
      humansInRoom < 2 &&
      room.members.length < 2 &&
      args.soloWithAi !== true
    ) {
      throw new Error("Waiting for another player");
    }
    if (humansInRoom >= 2 && args.soloWithAi !== true && !allHumansReady(room.members)) {
      throw new Error("Waiting for all players to be ready");
    }

    const autoFill = args.autoFillEmptySeats !== false;
    let members = [...room.members];
    let config = { ...room.config, playStyle: "standard" as const };

    if (autoFill || args.soloWithAi === true) {
      for (let seat = 0; seat < room.config.numPlayers; seat++) {
        if (!memberAtSeat(members, seat)) {
          addBotAtSeat(members, seat);
        }
      }
    } else {
      if (members.length < 2) {
        throw new Error("Need at least 2 players");
      }
      members = members
        .sort((a, b) => a.seatIndex - b.seatIndex)
        .map((m, i) => ({ ...m, seatIndex: i }));
      config = { ...config, numPlayers: members.length };
    }

    members.sort((a, b) => a.seatIndex - b.seatIndex);
    const playerIds: PlayerId[] = members.map((_, i) => `p${i}`);
    const membersWithIds = members.map((m, i) => ({
      ...m,
      playerId: playerIds[i]!,
    }));

    const rules = onlineRules(config);
    const gameState = createGame(playerIds, {
      seed: (Math.random() * 2 ** 32) >>> 0,
      rules,
    });

    await ctx.db.patch(args.roomId, {
      status: "playing",
      config,
      members: membersWithIds,
      turnTimerSeconds: DEFAULT_TURN_SECONDS,
      ...touchFields(),
      version: room.version + 1,
    });

    const updated = await ctx.db.get(args.roomId);
    if (updated) {
      await applyGameUpdate(ctx, args.roomId, updated, gameState);
    }
  },
});

export const returnToLobby = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "finished") {
      throw new Error("Cannot return to lobby");
    }

    const member = findMember(room, userId);
    if (!member) {
      throw new Error("Not a member of this room");
    }

    await ctx.db.patch(args.roomId, {
      status: "lobby",
      gameState: undefined,
      turnDeadlineAt: undefined,
      returnWindow: undefined,
      pendingReveal: undefined,
      recentReaction: undefined,
      members: lobbyHumans(room.members),
      ...touchFields(),
      version: room.version + 1,
    });
  },
});

export const setReady = mutation({
  args: {
    roomId: v.id("rooms"),
    ready: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot set ready outside lobby");
    }

    const member = findMember(room, userId);
    if (!member) {
      throw new Error("Not a member of this room");
    }

    const members = room.members.map((m) =>
      m.userId === userId ? { ...m, isReady: args.ready } : m,
    );

    await ctx.db.patch(args.roomId, {
      members,
      ...touchFields(),
      version: room.version + 1,
    });
  },
});

export const submitMove = mutation({
  args: {
    roomId: v.id("rooms"),
    move: moveValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "playing" || !room.gameState) {
      throw new Error("Game is not in progress");
    }

    const member = findMember(room, userId);
    if (!member?.playerId) {
      throw new Error("Not a member of this room");
    }

    const move = args.move as Move;
    if (move.player !== member.playerId) {
      throw new Error("Move player mismatch");
    }

    const gameState = room.gameState as GameState;
    const now = Date.now();
    const snapshot =
      isCardMove(move) && move.player === member.playerId
        ? cloneGameState(gameState)
        : undefined;
    const next = applyMove(gameState, move);
    await applyGameUpdate(ctx, args.roomId, room, next, {
      returnWindow: snapshot
        ? {
            playerId: member.playerId,
            preMoveState: snapshot,
            expiresAt: now + RETURN_WINDOW_MS,
          }
        : undefined,
    });
  },
});

export const useReturnAbility = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "playing" || !room.gameState) {
      throw new Error("Game is not in progress");
    }

    const member = findMember(room, userId);
    if (!member?.playerId) {
      throw new Error("Not a member of this room");
    }

    const window = room.returnWindow;
    if (!window || window.playerId !== member.playerId) {
      throw new Error("Return is not available");
    }
    if (Date.now() > window.expiresAt) {
      throw new Error("Return window expired");
    }

    const restored = window.preMoveState as GameState;
    await applyGameUpdate(ctx, args.roomId, room, restored, {
      clearReturnWindow: true,
    });
  },
});

export const useGraveyardAbility = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "playing" || !room.gameState) {
      throw new Error("Game is not in progress");
    }

    if (!findMember(room, userId)) {
      throw new Error("Not a member of this room");
    }

    const goldBalance = await deductGold(
      ctx,
      userId,
      GRAVEYARD_GOLD_COST,
      "graveyard",
    );
    return { goldBalance };
  },
});

export const useRevealAbility = mutation({
  args: {
    roomId: v.id("rooms"),
    opponentId: v.string(),
    cardIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "playing" || !room.gameState) {
      throw new Error("Game is not in progress");
    }

    const member = findMember(room, userId);
    if (!member?.playerId) {
      throw new Error("Not a member of this room");
    }

    const gameState = room.gameState as GameState;
    const card = pickRevealedCard(
      gameState,
      member.playerId,
      args.opponentId as PlayerId,
      args.cardIndex,
    );

    const goldBalance = await deductGold(
      ctx,
      userId,
      REVEAL_GOLD_COST,
      "reveal",
    );

    const now = Date.now();
    const revealExpiresAt = now + REVEAL_DISPLAY_MS;
    let turnDeadlineAt = room.turnDeadlineAt;
    if (turnDeadlineAt != null && turnDeadlineAt > now) {
      turnDeadlineAt = turnDeadlineAt + REVEAL_DISPLAY_MS;
      await ctx.scheduler.runAfter(
        turnDeadlineAt - now,
        internal.rooms.processHumanTimeout,
        { roomId: args.roomId, expectedDeadline: turnDeadlineAt },
      );
    }

    await ctx.db.patch(args.roomId, {
      pendingReveal: {
        userId,
        card,
        expiresAt: revealExpiresAt,
      },
      turnDeadlineAt,
      ...touchFields(now),
      version: room.version + 1,
    });

    return { goldBalance, card };
  },
});

export const getRoomView = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    const member = findMember(room, userId);
    if (!member) return null;

    const names = memberNames(room.members);
    const yourPlayerId = member.playerId ?? null;
    let gameState: GameState | null = null;

    if (room.gameState && yourPlayerId) {
      gameState = sanitizeGameState(room.gameState as GameState, yourPlayerId);
    }

    return {
      roomId: room._id,
      code: room.code,
      status: room.status,
      config: room.config,
      members: room.members.map((m) => ({
        displayName: m.displayName,
        seatIndex: m.seatIndex,
        isBot: m.isBot,
        playerId: m.playerId,
        isReady: m.isReady,
      })),
      names,
      yourPlayerId,
      gameState,
      lastMoveAt: room.lastMoveAt,
      turnDeadlineAt: room.turnDeadlineAt ?? null,
      turnTimerSeconds: room.turnTimerSeconds ?? DEFAULT_TURN_SECONDS,
      recentReaction: room.recentReaction ?? null,
      isHost: isHost(room, userId),
      humanCount: humanMemberCount(room.members),
      readyCount: readyHumanCount(room.members),
      allHumansReady: allHumansReady(room.members),
      yourIsReady: member.isReady === true,
      returnExpiresAt:
        room.returnWindow?.playerId === yourPlayerId &&
        room.returnWindow.expiresAt > Date.now()
          ? room.returnWindow.expiresAt
          : null,
      pendingReveal:
        room.pendingReveal?.userId === userId &&
        room.pendingReveal.expiresAt > Date.now()
          ? {
              card: room.pendingReveal.card,
              expiresAt: room.pendingReveal.expiresAt,
            }
          : null,
    };
  },
});

export const getRoomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
      .first();
    if (!room || room.status !== "lobby") return null;
    return {
      roomId: room._id,
      humanCount: humanMemberCount(room.members),
      maxPlayers: room.config.numPlayers,
    };
  },
});

export const getRoomInternal = internalQuery({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId);
  },
});

export const cleanupStaleRooms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const lobbyCutoff = now - LOBBY_STALE_MS;
    const playingCutoff = now - PLAYING_STALE_MS;

    const candidates = await ctx.db
      .query("rooms")
      .withIndex("by_lastTouchedAt", (q) => q.lt("lastTouchedAt", lobbyCutoff))
      .take(CLEANUP_BATCH_SIZE);

    let deleted = 0;
    for (const room of candidates) {
      const touched = room.lastTouchedAt ?? room.lastMoveAt;
      const stale =
        room.status === "lobby"
          ? touched < lobbyCutoff
          : touched < playingCutoff;
      if (stale) {
        await ctx.db.delete(room._id);
        deleted++;
      }
    }

    return { deleted };
  },
});

export const processHumanTimeout = internalMutation({
  args: {
    roomId: v.id("rooms"),
    expectedDeadline: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "playing" || !room.gameState) return;
    if (room.turnDeadlineAt !== args.expectedDeadline) return;

    const state = room.gameState as GameState;
    const bots = botPlayerIds(room.members);
    const human = activeHumanPlayer(state, bots);
    if (!human) return;

    const move = timeoutMoveFor(state, human);
    if (!move) return;

    let next: GameState;
    try {
      next = applyMove(state, move);
    } catch {
      return;
    }

    await applyGameUpdate(ctx, args.roomId, room, next);
  },
});

export const processBotTurns = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "playing" || !room.gameState) return;

    const state = room.gameState as GameState;
    const bots = botPlayerIds(room.members);

    if (shouldDeferBot(state, bots)) return;

    const move = findBotMove(state, bots, room.config.difficulty);
    if (!move) return;

    const delay = AI_DELAY[room.config.difficulty];
    await ctx.scheduler.runAfter(delay, internal.rooms.applyBotMove, {
      roomId: args.roomId,
      move,
    });
  },
});

export const applyBotMove = internalMutation({
  args: {
    roomId: v.id("rooms"),
    move: moveValidator,
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "playing" || !room.gameState) return;

    const gameState = room.gameState as GameState;
    let next: GameState;
    try {
      next = applyMove(gameState, args.move as Move);
    } catch {
      return;
    }

    await applyGameUpdate(ctx, args.roomId, room, next);
  },
});

export type RoomView = {
  roomId: Id<"rooms">;
  code: string;
  status: "lobby" | "playing" | "finished";
  config: {
    numPlayers: number;
    variant: "podkidnoy" | "perevodnoy";
    throwInScope: "all" | "neighbor";
    playStyle: "standard" | "abilities";
    difficulty: "easy" | "medium" | "hard";
  };
  members: {
    displayName: string;
    seatIndex: number;
    isBot: boolean;
    playerId?: string;
    isReady?: boolean;
  }[];
  names: Record<string, string>;
  yourPlayerId: string | null;
  gameState: GameState | null;
  lastMoveAt: number;
  turnDeadlineAt: number | null;
  turnTimerSeconds: number;
  recentReaction: { emoji: string; fromPlayerId: string; at: number } | null;
  isHost: boolean;
  humanCount: number;
  readyCount: number;
  allHumansReady: boolean;
  yourIsReady: boolean;
  returnExpiresAt: number | null;
  pendingReveal: {
    card: Card;
    expiresAt: number;
  } | null;
};
