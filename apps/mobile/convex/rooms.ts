import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v, type Infer } from "convex/values";
import {
  applyMove,
  canTransfer,
  cloneGameState,
  createGame,
  forceForfeitEnd,
  pickMove,
  type GameState,
  type Card,
  type Move,
  type PlayerId,
  aiMoveDelayMs,
  normalizeTurnSeconds,
} from "@durak/game-core";
import { randomBotId, randomRoomCode } from "./lib/codes";
import {
  activeHumanPlayer,
  botPlayerIds,
  DEFAULT_TURN_SECONDS,
  LOBBY_STALE_MS,
  MAX_RECENT_CLIENT_MOVE_IDS,
  NETWORK_GRACE_MS,
  PLAYING_STALE_MS,
  RECONNECT_SILENCE_MS,
  RECONNECT_WINDOW_MS,
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
import { resumableRoomsFor } from "./lib/resumeHelpers";
import { onlineRules } from "./lib/onlineRules";
import { memberNames, sanitizeGameState } from "./lib/views";
import {
  chargeMatchBuyIns,
  deductGold,
  GRAVEYARD_GOLD_COST,
  REVEAL_GOLD_COST,
  settleMatchEconomy,
} from "./wallets";
import { pickRevealedCard } from "./lib/revealHelpers";
import { normalizeDisplayName } from "./lib/displayName";
import { MATCH_BUY_IN } from "./lib/goldEconomy";

const CLEANUP_BATCH_SIZE = 100;
const RETURN_WINDOW_MS = 3000;
const REVEAL_DISPLAY_MS = 4000;
const REMATCH_FALLBACK_MS = 2 * 60 * 1000;
const REJOIN_NUDGE_MS = 3 * 60 * 1000;

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

type AiDifficultyLevel = "easy" | "medium" | "hard";

function botDifficultyForPlayer(
  members: RoomDoc["members"],
  playerId: string,
  roomDifficulty: AiDifficultyLevel,
): AiDifficultyLevel {
  const member = members.find((m) => m.playerId === playerId && m.isBot);
  return member?.difficulty ?? roomDifficulty;
}

function findBotMove(
  state: GameState,
  bots: Set<string>,
  members: RoomDoc["members"],
  roomDifficulty: AiDifficultyLevel,
): { move: Move; difficulty: AiDifficultyLevel } | null {
  for (const p of state.players) {
    if (!bots.has(p)) continue;
    const difficulty = botDifficultyForPlayer(members, p, roomDifficulty);
    const move = pickMove(state, p, difficulty);
    if (move) return { move, difficulty };
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

async function scheduleHumanTurnClock(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  turnTimerSeconds: number,
  humanPlayerId: PlayerId,
  now = Date.now(),
): Promise<{ turnDeadlineAt: number; turnClockPlayerId: PlayerId }> {
  const turnDeadlineAt = now + turnTimerSeconds * 1000;
  await ctx.scheduler.runAfter(
    turnTimerSeconds * 1000,
    internal.rooms.processHumanTimeout,
    { roomId, expectedDeadline: turnDeadlineAt },
  );
  return { turnDeadlineAt, turnClockPlayerId: humanPlayerId };
}

async function applyGameUpdate(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  room: RoomDoc,
  next: GameState,
  options?: {
    returnWindow?: RoomDoc["returnWindow"];
    clearReturnWindow?: boolean;
    /** After a null timeout, only forced seats may own the clock. */
    clockForcedOnly?: boolean;
    /** Clear idle-timeout strikes for this player after a real move. */
    clearIdleStrikeFor?: PlayerId;
    /** Replace members (e.g. stamp lastSeenAt on submitter). */
    members?: RoomDoc["members"];
    /** Persist idempotency log after a successful human move. */
    recentClientMoveIds?: RoomDoc["recentClientMoveIds"];
    /** Clear reconnect hold when the match ends or a real move lands. */
    clearReconnectHold?: boolean;
  },
) {
  const status = next.phase === "gameOver" ? "finished" : "playing";
  const bots = botPlayerIds(options?.members ?? room.members);
  const turnTimerSeconds = room.turnTimerSeconds ?? DEFAULT_TURN_SECONDS;
  const now = Date.now();

  let turnDeadlineAt: number | undefined = undefined;
  let turnClockPlayerId: string | undefined = undefined;
  if (next.phase === "playing") {
    const human = activeHumanPlayer(next, bots, {
      forcedOnly: options?.clockForcedOnly,
    });
    if (human) {
      const clock = await scheduleHumanTurnClock(
        ctx,
        roomId,
        turnTimerSeconds,
        human,
        now,
      );
      turnDeadlineAt = clock.turnDeadlineAt;
      turnClockPlayerId = clock.turnClockPlayerId;
    }
  }

  let economy = room.economy;
  if (next.phase === "gameOver") {
    await settleMatchEconomy(ctx, room, next);
    if (economy?.buyInsCharged) {
      economy = { ...economy, settled: true };
    }
  }

  const returnWindowPatch =
    options?.clearReturnWindow === false
      ? {}
      : options?.returnWindow
        ? { returnWindow: options.returnWindow }
        : { returnWindow: undefined };

  let idleTimeoutStrikes: Record<string, number> | undefined =
    room.idleTimeoutStrikes
      ? { ...room.idleTimeoutStrikes }
      : undefined;
  if (status === "finished") {
    idleTimeoutStrikes = undefined;
  } else if (options?.clearIdleStrikeFor) {
    if (idleTimeoutStrikes) {
      delete idleTimeoutStrikes[options.clearIdleStrikeFor];
      if (Object.keys(idleTimeoutStrikes).length === 0) {
        idleTimeoutStrikes = undefined;
      }
    }
  }

  await ctx.db.patch(roomId, {
    gameState: next,
    status,
    ...touchFields(now),
    turnDeadlineAt,
    turnClockPlayerId,
    ...returnWindowPatch,
    pendingReveal: undefined,
    economy,
    idleTimeoutStrikes,
    version: room.version + 1,
    ...(options?.members ? { members: options.members } : {}),
    ...(options?.recentClientMoveIds !== undefined
      ? { recentClientMoveIds: options.recentClientMoveIds }
      : {}),
    ...(status === "finished" || options?.clearReconnectHold
      ? { reconnectHoldDeadline: undefined }
      : {}),
  });

  if (next.phase === "playing" && bots.size > 0) {
    await ctx.scheduler.runAfter(0, internal.rooms.processBotTurns, { roomId });
  }

  if (status === "finished") {
    await ctx.scheduler.runAfter(
      REMATCH_FALLBACK_MS,
      internal.rooms.autoReturnToLobby,
      { roomId },
    );
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

/**
 * Create a fresh lobby room owned by `hostUserId` (a session-scoped subject
 * from `requireUserId`). Shared by `createRoom` and the invites flow.
 */
export async function createRoomForHost(
  ctx: MutationCtx,
  args: {
    hostUserId: string;
    displayName: string;
    config: Infer<typeof roomConfigValidator>;
    turnTimerSeconds?: number;
    buyIn?: number;
  },
): Promise<{ roomId: Id<"rooms">; code: string }> {
  // Invites / alternate create paths also clear ghost playing seats.
  await releasePlayingMembership(ctx, args.hostUserId);

  const numPlayers = Math.min(6, Math.max(2, args.config.numPlayers));
  const config = { ...args.config, numPlayers };
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
    hostUserId: args.hostUserId,
    config,
    members: [
      {
        userId: args.hostUserId,
        displayName: normalizeDisplayName(args.displayName) || "Host",
        seatIndex: 0,
        isBot: false,
        isReady: false,
      },
    ],
    buyIn: args.buyIn ?? MATCH_BUY_IN,
    lastMoveAt: now,
    lastTouchedAt: now,
    turnTimerSeconds: normalizeTurnSeconds(args.turnTimerSeconds),
    version: 0,
  });

  return { roomId, code };
}

/**
 * One account = one live match. When the user joins/creates a new lobby after
 * reinstall, crash, or force-quit, auto-forfeit any leftover playing seats so
 * they are not stuck behind a cryptic "already in a match" error.
 */
async function releasePlayingMembership(
  ctx: MutationCtx,
  userId: string,
  exceptRoomId?: Id<"rooms">,
) {
  const playing = await ctx.db
    .query("rooms")
    .withIndex("by_status", (q) => q.eq("status", "playing"))
    .collect();

  for (const room of playing) {
    if (exceptRoomId && room._id === exceptRoomId) continue;
    if (!findMember(room, userId)) continue;

    const fresh = await ctx.db.get(room._id);
    if (!fresh || fresh.status !== "playing") continue;
    const member = findMember(fresh, userId);
    if (!member) continue;

    if (fresh.gameState && member.playerId) {
      try {
        const next = forceForfeitEnd(
          fresh.gameState as GameState,
          member.playerId,
        );
        await applyGameUpdate(ctx, fresh._id, fresh, next);
      } catch {
        // Still drop the seat below even if forfeit-end fails.
      }
    }

    const after = await ctx.db.get(fresh._id);
    if (after && findMember(after, userId)) {
      await removeMemberFromRoom(ctx, after._id, after, userId);
    }
  }
}

export const createRoom = mutation({
  args: {
    config: roomConfigValidator,
    displayName: v.string(),
    turnTimerSeconds: v.optional(v.number()),
    buyIn: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await createRoomForHost(ctx, {
      hostUserId: userId,
      displayName: args.displayName,
      config: args.config,
      turnTimerSeconds: args.turnTimerSeconds,
      buyIn: args.buyIn,
    });
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

    if (!room || (room.status !== "lobby" && room.status !== "finished")) {
      throw new Error("Room not found or game already started");
    }

    // Already seated in this room — return existing seat (no double-seat).
    const existing = findMember(room, userId);
    if (existing && !existing.isBot) {
      return { roomId: room._id, seatIndex: existing.seatIndex };
    }

    // Clear ghost seats from abandoned matches (reinstall / crash / force-quit).
    await releasePlayingMembership(ctx, userId, room._id);

    const seat = nextOpenSeat(room.members, room.config.numPlayers);
    if (seat === null) {
      throw new Error("Room is full");
    }

    const members = [
      ...room.members,
      {
        userId,
        displayName: normalizeDisplayName(args.displayName) || "Player",
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
      // End the match when we can; always drop the seat so Resume cannot stick.
      if (room.gameState && member.playerId) {
        const next = forceForfeitEnd(
          room.gameState as GameState,
          member.playerId,
        );
        await applyGameUpdate(ctx, args.roomId, room, next);
      }
      const after = await ctx.db.get(args.roomId);
      if (after && findMember(after, userId)) {
        await removeMemberFromRoom(ctx, after._id, after, userId);
      }
    }
  },
});

export const touchRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    /** false = app backgrounded / hidden → stamp away for reconnect UI. */
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) return;
    if (!findMember(room, userId)) return;

    const now = Date.now();
    const lastSeenAt =
      args.active === false ? now - RECONNECT_SILENCE_MS - 1 : now;
    const members = room.members.map((m) =>
      m.userId === userId && !m.isBot ? { ...m, lastSeenAt } : m,
    );
    await ctx.db.patch(args.roomId, {
      lastTouchedAt: args.active === false ? room.lastTouchedAt ?? now : now,
      members,
    });
  },
});

export const updateDisplayName = mutation({
  args: {
    roomId: v.id("rooms"),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    const memberIndex = room.members.findIndex((m) => m.userId === userId);
    if (memberIndex < 0) throw new Error("Not a member of this room");

    const trimmed = normalizeDisplayName(args.displayName) || "Player";
    const current = room.members[memberIndex]!.displayName;
    if (current === trimmed) return;

    const members = room.members.map((m, i) =>
      i === memberIndex ? { ...m, displayName: trimmed } : m,
    );

    await ctx.db.patch(args.roomId, {
      members,
      ...touchFields(),
      version: room.version + 1,
    });
  },
});

/** Pack tokens (`z.cool`, `d.love`, `n.1f602`) or short Unicode emoji for classic. */
const PACK_REACTION_TOKEN = /^[zdn]\.[a-z0-9_]{1,32}$/;
const MAX_REACTION_TOKEN_LENGTH = 48;

function sanitizeReactionToken(raw: string): string | null {
  const trimmed = raw.trim().slice(0, MAX_REACTION_TOKEN_LENGTH);
  if (!trimmed) return null;
  if (PACK_REACTION_TOKEN.test(trimmed)) return trimmed;
  // Classic Unicode / short emoji grapheme cluster (keep multi-codepoint faces).
  if ([...trimmed].length <= 8) return trimmed;
  return null;
}

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

    const token = sanitizeReactionToken(args.emoji);
    if (!token) return;

    const now = Date.now();
    await ctx.db.patch(args.roomId, {
      recentReaction: {
        emoji: token,
        fromPlayerId: member.playerId,
        at: now,
      },
      lastTouchedAt: now,
      version: room.version + 1,
    });
  },
});

const difficultyValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
);

function addBotAtSeat(
  members: RoomDoc["members"],
  seat: number,
  difficulty?: AiDifficultyLevel,
): void {
  const botIndex = members.filter((m) => m.isBot).length;
  members.push({
    userId: randomBotId(),
    displayName: BOT_NAMES[botIndex] ?? `Bot ${botIndex + 1}`,
    seatIndex: seat,
    isBot: true,
    difficulty: difficulty ?? "medium",
  });
}

export const setLobbyBot = mutation({
  args: {
    roomId: v.id("rooms"),
    seatIndex: v.number(),
    enabled: v.boolean(),
    difficulty: v.optional(difficultyValidator),
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
      addBotAtSeat(
        members,
        args.seatIndex,
        args.difficulty ?? room.config.difficulty,
      );
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

export const setLobbyBotDifficulty = mutation({
  args: {
    roomId: v.id("rooms"),
    seatIndex: v.number(),
    difficulty: difficultyValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "lobby") {
      throw new Error("Cannot change AI difficulty outside lobby");
    }
    if (!isHost(room, userId)) {
      throw new Error("Only the host can change AI difficulty");
    }

    const atSeat = memberAtSeat(room.members, args.seatIndex);
    if (!atSeat?.isBot) {
      throw new Error("No AI at this seat");
    }

    const members = room.members.map((m) =>
      m.seatIndex === args.seatIndex && m.isBot
        ? { ...m, difficulty: args.difficulty }
        : m,
    );

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

export const setRoomTurnTimerSeconds = mutation({
  args: {
    roomId: v.id("rooms"),
    turnTimerSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || (room.status !== "lobby" && room.status !== "playing")) {
      throw new Error("Cannot change turn timer outside lobby or active game");
    }
    if (!isHost(room, userId)) {
      throw new Error("Only the host can change the turn timer");
    }

    const turnTimerSeconds = normalizeTurnSeconds(args.turnTimerSeconds);
    const now = Date.now();
    const patch: {
      turnTimerSeconds: number;
      version: number;
      lastMoveAt: number;
      lastTouchedAt: number;
      turnDeadlineAt?: number;
      turnClockPlayerId?: string;
    } = {
      turnTimerSeconds,
      ...touchFields(now),
      version: room.version + 1,
    };

    if (
      room.status === "playing" &&
      room.turnDeadlineAt != null &&
      room.turnClockPlayerId != null
    ) {
      const clock = await scheduleHumanTurnClock(
        ctx,
        args.roomId,
        turnTimerSeconds,
        room.turnClockPlayerId,
        now,
      );
      patch.turnDeadlineAt = clock.turnDeadlineAt;
      patch.turnClockPlayerId = clock.turnClockPlayerId;
    }

    await ctx.db.patch(args.roomId, patch);
  },
});

async function beginNextRound(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  room: RoomDoc,
  options: {
    autoFillEmptySeats?: boolean;
    members?: RoomDoc["members"];
    config?: RoomDoc["config"];
  } = {},
) {
  const autoFill = options.autoFillEmptySeats !== false;
  let members = options.members ?? [...room.members];
  let config = options.config ?? { ...room.config };

  if (autoFill) {
    members = lobbyHumans(members);
    for (let seat = 0; seat < config.numPlayers; seat++) {
      if (!memberAtSeat(members, seat)) {
        addBotAtSeat(members, seat, config.difficulty);
      }
    }
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

  await chargeMatchBuyIns(ctx, membersWithIds, room.buyIn ?? MATCH_BUY_IN);

  const nextVersion = room.version + 1;
  await ctx.db.patch(roomId, {
    status: "playing",
    config,
    members: membersWithIds,
    turnTimerSeconds: room.turnTimerSeconds ?? DEFAULT_TURN_SECONDS,
    turnDeadlineAt: undefined,
    turnClockPlayerId: undefined,
    idleTimeoutStrikes: undefined,
    returnWindow: undefined,
    pendingReveal: undefined,
    recentReaction: undefined,
    economy: {
      roundVersion: nextVersion,
      buyInsCharged: true,
      settled: false,
    },
    ...touchFields(),
    version: nextVersion,
  });

  const updated = await ctx.db.get(roomId);
  if (updated) {
    await applyGameUpdate(ctx, roomId, updated, gameState);
  }
}

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

    // Host tapping Start implies the host is ready — only guests must have
    // tapped I'm Ready. Persist host ready so lobby state stays consistent.
    let members = room.members.map((m) =>
      m.userId === userId ? { ...m, isReady: true } : m,
    );
    const guests = members.filter((m) => !m.isBot && m.userId !== userId);
    if (
      humansInRoom >= 2 &&
      args.soloWithAi !== true &&
      guests.some((m) => m.isReady !== true)
    ) {
      throw new Error("Waiting for all players to be ready");
    }

    if (members.some((m, i) => m.isReady !== room.members[i]?.isReady)) {
      await ctx.db.patch(args.roomId, { members });
    }

    const autoFill = args.autoFillEmptySeats !== false;
    let config = { ...room.config };

    if (autoFill || args.soloWithAi === true) {
      await beginNextRound(ctx, args.roomId, room, { autoFillEmptySeats: true });
      return;
    }

    if (members.length < 2) {
      throw new Error("Need at least 2 players");
    }
    members = members
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((m, i) => ({ ...m, seatIndex: i }));
    config = { ...config, numPlayers: members.length };

    await beginNextRound(ctx, args.roomId, room, {
      autoFillEmptySeats: false,
      members,
      config,
    });
  },
});

export const rematch = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "finished") {
      throw new Error("Cannot start rematch");
    }
    if (!isHost(room, userId)) {
      throw new Error("Only the host can start the next round");
    }
    if (humanMemberCount(room.members) < 1) {
      throw new Error("Need at least one player");
    }

    await beginNextRound(ctx, args.roomId, room, { autoFillEmptySeats: true });
    return { started: true };
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
      turnClockPlayerId: undefined,
      idleTimeoutStrikes: undefined,
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
    /** Client-generated id so retries after flaky networks do not double-apply. */
    clientMoveId: v.optional(v.string()),
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

    const clientMoveId = args.clientMoveId?.trim();
    if (clientMoveId) {
      const recent = room.recentClientMoveIds ?? [];
      if (recent.some((entry) => entry.id === clientMoveId)) {
        // Idempotent success — first attempt already applied.
        return { deduped: true as const, version: room.version };
      }
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

    let recentClientMoveIds = room.recentClientMoveIds ?? [];
    if (clientMoveId) {
      recentClientMoveIds = [
        ...recentClientMoveIds,
        { id: clientMoveId, at: now },
      ].slice(-MAX_RECENT_CLIENT_MOVE_IDS);
    }

    // Stamp presence so turn-clock grace treats an in-flight submitter as live.
    const members = room.members.map((m) =>
      m.userId === userId && !m.isBot ? { ...m, lastSeenAt: now } : m,
    );

    await applyGameUpdate(ctx, args.roomId, room, next, {
      returnWindow: snapshot
        ? {
            playerId: member.playerId,
            preMoveState: snapshot,
            expiresAt: now + RETURN_WINDOW_MS,
          }
        : undefined,
      clearIdleStrikeFor: member.playerId,
      members,
      recentClientMoveIds: clientMoveId ? recentClientMoveIds : undefined,
      clearReconnectHold: true,
    });

    return { deduped: false as const, version: room.version + 1 };
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

    const graveCost =
      room.config.playStyle === "abilities" ? 0 : GRAVEYARD_GOLD_COST;
    const goldBalance = await deductGold(ctx, userId, graveCost, "graveyard");
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

    const revealCost =
      room.config.playStyle === "abilities" ? 0 : REVEAL_GOLD_COST;
    const goldBalance = await deductGold(ctx, userId, revealCost, "reveal");

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

    const now = Date.now();
    const clockOwner = room.turnClockPlayerId
      ? room.members.find(
          (m) => !m.isBot && m.playerId === room.turnClockPlayerId,
        )
      : undefined;
    const clockLastSeen =
      clockOwner?.lastSeenAt ?? room.lastTouchedAt ?? room.lastMoveAt;
    const clockSilence = now - clockLastSeen;
    const turnClockConnection =
      room.status === "playing" &&
      room.turnClockPlayerId &&
      clockOwner &&
      clockSilence > RECONNECT_SILENCE_MS &&
      clockSilence < RECONNECT_WINDOW_MS
        ? ("reconnecting" as const)
        : ("ok" as const);

    return {
      roomId: room._id,
      code: room.code,
      status: room.status,
      buyIn: room.buyIn ?? MATCH_BUY_IN,
      config: room.config,
      members: room.members.map((m) => ({
        displayName: m.displayName,
        seatIndex: m.seatIndex,
        isBot: m.isBot,
        playerId: m.playerId,
        isReady: m.isReady,
        difficulty: m.difficulty,
        isSelf: m.userId === userId,
        lastSeenAt: m.lastSeenAt ?? null,
      })),
      names,
      yourPlayerId,
      gameState,
      version: room.version,
      lastMoveAt: room.lastMoveAt,
      turnDeadlineAt: room.turnDeadlineAt ?? null,
      turnClockPlayerId: room.turnClockPlayerId ?? null,
      turnClockConnection:
        room.status === "playing" && room.turnClockPlayerId
          ? turnClockConnection
          : null,
      turnTimerSeconds: room.turnTimerSeconds ?? DEFAULT_TURN_SECONDS,
      recentReaction: room.recentReaction ?? null,
      isHost: isHost(room, userId),
      humanCount: humanMemberCount(room.members),
      readyCount: readyHumanCount(room.members),
      allHumansReady: allHumansReady(room.members),
      yourIsReady: member.isReady === true,
      returnExpiresAt:
        room.returnWindow?.playerId === yourPlayerId &&
        room.returnWindow.expiresAt > now
          ? room.returnWindow.expiresAt
          : null,
      pendingReveal:
        room.pendingReveal?.userId === userId &&
        room.pendingReveal.expiresAt > now
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
    if (!room || (room.status !== "lobby" && room.status !== "finished")) return null;
    return {
      roomId: room._id,
      humanCount: humanMemberCount(room.members),
      maxPlayers: room.config.numPlayers,
    };
  },
});

/**
 * Rooms the current user can resume — any lobby/playing room where they still
 * hold a (non-bot) seat. Source of truth for the Home/Friends "Resume game"
 * entry points, so rejoin works even after local session memory is gone.
 *
 * Scans by status; the active-room set is bounded by the stale-cleanup cron, so
 * this stays small. If room volume ever grows, replace with a membership index.
 */
export const myActiveRooms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const rooms: RoomDoc[] = [];
    for (const status of ["playing", "lobby"] as const) {
      const batch = await ctx.db
        .query("rooms")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      rooms.push(...batch);
    }

    return resumableRoomsFor(rooms, userId);
  },
});

export const autoReturnToLobby = internalMutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "finished") return;

    await ctx.db.patch(args.roomId, {
      status: "lobby",
      gameState: undefined,
      turnDeadlineAt: undefined,
      turnClockPlayerId: undefined,
      idleTimeoutStrikes: undefined,
      returnWindow: undefined,
      pendingReveal: undefined,
      recentReaction: undefined,
      members: lobbyHumans(room.members),
      ...touchFields(),
      version: room.version + 1,
    });
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
        room.status === "lobby" || room.status === "finished"
          ? touched < lobbyCutoff
          : touched < playingCutoff;
      if (stale) {
        const invites = await ctx.db
          .query("gameInvites")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();
        for (const invite of invites) {
          await ctx.db.delete(invite._id);
        }
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

    const now = Date.now();

    // Network grace: in-flight moves / high RTT get a short buffer before a strike.
    if (now < args.expectedDeadline + NETWORK_GRACE_MS) {
      await ctx.scheduler.runAfter(
        args.expectedDeadline + NETWORK_GRACE_MS - now,
        internal.rooms.processHumanTimeout,
        { roomId: args.roomId, expectedDeadline: args.expectedDeadline },
      );
      return;
    }

    const state = room.gameState as GameState;
    const bots = botPlayerIds(room.members);
    const human = activeHumanPlayer(state, bots);
    if (!human) return;

    const absentMember = room.members.find(
      (m) => !m.isBot && m.playerId === human,
    );
    const lastSeen =
      absentMember?.lastSeenAt ?? room.lastTouchedAt ?? room.lastMoveAt;
    const silence = now - lastSeen;
    const recentlyInMatch = silence < RECONNECT_WINDOW_MS;
    const appearsReconnecting =
      recentlyInMatch && silence > RECONNECT_SILENCE_MS;

    // One free clock cycle while the seat looks like a reconnect (flaky WiFi).
    if (
      appearsReconnecting &&
      room.reconnectHoldDeadline !== args.expectedDeadline
    ) {
      const turnTimerSeconds = room.turnTimerSeconds ?? DEFAULT_TURN_SECONDS;
      const clock = await scheduleHumanTurnClock(
        ctx,
        args.roomId,
        turnTimerSeconds,
        human,
        now,
      );
      await ctx.db.patch(args.roomId, {
        turnDeadlineAt: clock.turnDeadlineAt,
        turnClockPlayerId: clock.turnClockPlayerId,
        reconnectHoldDeadline: args.expectedDeadline,
        ...touchFields(now),
        version: room.version + 1,
      });
      return;
    }

    // No auto-play: count consecutive idle misses; 2nd miss ends the match.
    const strikes: Record<string, number> = {
      ...(room.idleTimeoutStrikes ?? {}),
    };
    const nextStrikes = (strikes[human] ?? 0) + 1;
    strikes[human] = nextStrikes;

    if (nextStrikes >= 2) {
      const ended = forceForfeitEnd(state, human);
      await applyGameUpdate(ctx, args.roomId, room, ended);
      return;
    }

    const turnTimerSeconds = room.turnTimerSeconds ?? DEFAULT_TURN_SECONDS;
    const clock = await scheduleHumanTurnClock(
      ctx,
      args.roomId,
      turnTimerSeconds,
      human,
      now,
    );

    // Nudge once per miss window (rate-limited) — first strike only path.
    let members = room.members;
    if (
      absentMember &&
      now - (absentMember.lastNudgeAt ?? 0) > REJOIN_NUDGE_MS
    ) {
      members = room.members.map((m) =>
        m.userId === absentMember.userId ? { ...m, lastNudgeAt: now } : m,
      );
      await ctx.scheduler.runAfter(0, internal.push.sendToUser, {
        userId: absentMember.userId as Id<"users">,
        title: "Your game is waiting",
        body: "It's your turn — tap to rejoin.",
        data: { type: "game_resume", roomId: args.roomId, code: room.code },
      });
    }

    await ctx.db.patch(args.roomId, {
      idleTimeoutStrikes: strikes,
      turnDeadlineAt: clock.turnDeadlineAt,
      turnClockPlayerId: clock.turnClockPlayerId,
      members,
      ...touchFields(now),
      version: room.version + 1,
    });
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

    const found = findBotMove(state, bots, room.members, room.config.difficulty);
    if (!found) return;

    const delay = aiMoveDelayMs(found.difficulty);
    await ctx.scheduler.runAfter(delay, internal.rooms.applyBotMove, {
      roomId: args.roomId,
      move: found.move,
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
      // Stale delayed bot move — re-drive so the table cannot stall.
      const bots = botPlayerIds(room.members);
      if (bots.size > 0) {
        await ctx.scheduler.runAfter(0, internal.rooms.processBotTurns, {
          roomId: args.roomId,
        });
      }
      return;
    }

    await applyGameUpdate(ctx, args.roomId, room, next);
  },
});

export type RoomView = {
  roomId: Id<"rooms">;
  code: string;
  status: "lobby" | "playing" | "finished";
  buyIn: number;
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
    difficulty?: "easy" | "medium" | "hard";
    isSelf: boolean;
    lastSeenAt: number | null;
  }[];
  names: Record<string, string>;
  yourPlayerId: string | null;
  gameState: GameState | null;
  version: number;
  lastMoveAt: number;
  turnDeadlineAt: number | null;
  turnClockPlayerId: string | null;
  turnClockConnection: "ok" | "reconnecting" | null;
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
