import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
  createGame,
  pickMove,
  type GameState,
  type Move,
  type PlayerId,
} from "@durak/game-core";
import { randomRoomCode, randomSessionToken } from "./lib/codes";
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
} from "./lib/roomHelpers";
import { memberNames, sanitizeGameState } from "./lib/views";

const AI_DELAY = { easy: 1400, medium: 750, hard: 320 } as const;
const INACTIVE_ROOM_MS = 5 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

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

function onlineRules(config: {
  variant: "podkidnoy" | "perevodnoy";
  throwInScope: "all" | "neighbor";
  playStyle: "standard" | "abilities";
}) {
  return {
    variant: config.variant,
    throwInScope: config.throwInScope,
    playStyle: "standard" as const,
  };
}

function botPlayerIds(members: { playerId?: string; isBot: boolean }[]): Set<string> {
  const ids = new Set<string>();
  for (const m of members) {
    if (m.isBot && m.playerId) ids.add(m.playerId);
  }
  return ids;
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

export const createRoom = mutation({
  args: {
    config: roomConfigValidator,
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionToken = randomSessionToken();
    const numPlayers = Math.min(6, Math.max(2, args.config.numPlayers));
    const config = { ...args.config, numPlayers };

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
      hostSessionToken: sessionToken,
      config,
      members: [
        {
          sessionToken,
          displayName: args.displayName.trim() || "Host",
          seatIndex: 0,
          isBot: false,
          isReady: false,
        },
      ],
      lastMoveAt: Date.now(),
      version: 0,
    });

    return { roomId, code, sessionToken };
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
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

    const sessionToken = randomSessionToken();
    const members = [
      ...room.members,
      {
        sessionToken,
        displayName: args.displayName.trim() || "Player",
        seatIndex: seat,
        isBot: false,
        isReady: false,
      },
    ];

    await ctx.db.patch(room._id, {
      members,
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });

    return { roomId: room._id, sessionToken, seatIndex: seat };
  },
});

export const leaveRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return;

    const member = findMember(room, args.sessionToken);
    if (!member) return;

    if (room.status !== "lobby" && room.status !== "finished") return;

    let members = room.members.filter((m) => m.sessionToken !== args.sessionToken);
    let hostSessionToken = room.hostSessionToken;

    if (room.hostSessionToken === args.sessionToken) {
      const nextHost = members.find((m) => !m.isBot);
      if (!nextHost) {
        await ctx.db.delete(args.roomId);
        return;
      }
      hostSessionToken = nextHost.sessionToken;
    }

    await ctx.db.patch(args.roomId, {
      members,
      hostSessionToken,
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });
  },
});

function addBotAtSeat(
  members: { sessionToken: string; displayName: string; seatIndex: number; isBot: boolean }[],
  seat: number,
): void {
  const botIndex = members.filter((m) => m.isBot).length;
  members.push({
    sessionToken: randomSessionToken(),
    displayName: BOT_NAMES[botIndex] ?? `Bot ${botIndex + 1}`,
    seatIndex: seat,
    isBot: true,
  });
}

export const setLobbyBot = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    seatIndex: v.number(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot change AI seats outside lobby");
    }
    if (!isHost(room, args.sessionToken)) {
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
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });
  },
});

export const setRoomDifficulty = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot change difficulty outside lobby");
    }
    if (!isHost(room, args.sessionToken)) {
      throw new Error("Only the host can change AI difficulty");
    }

    await ctx.db.patch(args.roomId, {
      config: { ...room.config, difficulty: args.difficulty },
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });
  },
});

export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    soloWithAi: v.optional(v.boolean()),
    autoFillEmptySeats: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot start this room");
    }
    if (!isHost(room, args.sessionToken)) {
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
    let config = room.config;

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
      config = { ...room.config, numPlayers: members.length };
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
      gameState,
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });

    await ctx.scheduler.runAfter(0, internal.rooms.processBotTurns, {
      roomId: args.roomId,
    });
  },
});

export const returnToLobby = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "finished") {
      throw new Error("Cannot return to lobby");
    }

    const member = findMember(room, args.sessionToken);
    if (!member) {
      throw new Error("Not a member of this room");
    }

    await ctx.db.patch(args.roomId, {
      status: "lobby",
      gameState: undefined,
      members: lobbyHumans(room.members),
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });
  },
});

export const setReady = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    ready: v.boolean(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot set ready outside lobby");
    }

    const member = findMember(room, args.sessionToken);
    if (!member) {
      throw new Error("Not a member of this room");
    }

    const members = room.members.map((m) =>
      m.sessionToken === args.sessionToken ? { ...m, isReady: args.ready } : m,
    );

    await ctx.db.patch(args.roomId, {
      members,
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });
  },
});

export const submitMove = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
    move: moveValidator,
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "playing" || !room.gameState) {
      throw new Error("Game is not in progress");
    }

    const member = findMember(room, args.sessionToken);
    if (!member?.playerId) {
      throw new Error("Not a member of this room");
    }

    const move = args.move as Move;
    if (move.player !== member.playerId) {
      throw new Error("Move player mismatch");
    }

    const gameState = room.gameState as GameState;
    const next = applyMove(gameState, move);
    const status = next.phase === "gameOver" ? "finished" : "playing";

    await ctx.db.patch(args.roomId, {
      gameState: next,
      status,
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });

    if (next.phase === "playing") {
      await ctx.scheduler.runAfter(0, internal.rooms.processBotTurns, {
        roomId: args.roomId,
      });
    }
  },
});

export const getRoomView = query({
  args: {
    roomId: v.id("rooms"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;

    const member = findMember(room, args.sessionToken);
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
      isHost: isHost(room, args.sessionToken),
      humanCount: humanMemberCount(room.members),
      readyCount: readyHumanCount(room.members),
      allHumansReady: allHumansReady(room.members),
      yourIsReady: member.isReady === true,
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
    const cutoff = Date.now() - INACTIVE_ROOM_MS;
    const stale = await ctx.db
      .query("rooms")
      .withIndex("by_lastMoveAt", (q) => q.lt("lastMoveAt", cutoff))
      .take(CLEANUP_BATCH_SIZE);

    for (const room of stale) {
      await ctx.db.delete(room._id);
    }

    return { deleted: stale.length };
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

    const status = next.phase === "gameOver" ? "finished" : "playing";
    await ctx.db.patch(args.roomId, {
      gameState: next,
      status,
      lastMoveAt: Date.now(),
      version: room.version + 1,
    });

    if (next.phase === "playing") {
      await ctx.scheduler.runAfter(0, internal.rooms.processBotTurns, {
        roomId: args.roomId,
      });
    }
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
  isHost: boolean;
  humanCount: number;
  readyCount: number;
  allHumansReady: boolean;
  yourIsReady: boolean;
};
