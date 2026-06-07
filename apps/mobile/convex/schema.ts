import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const cardValidator = v.object({
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
});

const roomConfig = v.object({
  numPlayers: v.number(),
  variant: v.union(v.literal("podkidnoy"), v.literal("perevodnoy")),
  throwInScope: v.union(v.literal("all"), v.literal("neighbor")),
  playStyle: v.union(v.literal("standard"), v.literal("abilities")),
  difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
});

const roomMember = v.object({
  userId: v.string(),
  displayName: v.string(),
  seatIndex: v.number(),
  isBot: v.boolean(),
  playerId: v.optional(v.string()),
  isReady: v.optional(v.boolean()),
});

const recentReaction = v.object({
  emoji: v.string(),
  fromPlayerId: v.string(),
  at: v.number(),
});

const returnWindow = v.object({
  playerId: v.string(),
  preMoveState: v.any(),
  expiresAt: v.number(),
});

const pendingReveal = v.object({
  userId: v.string(),
  card: cardValidator,
  expiresAt: v.number(),
});

export default defineSchema({
  ...authTables,
  rooms: defineTable({
    code: v.string(),
    status: v.union(v.literal("lobby"), v.literal("playing"), v.literal("finished")),
    hostUserId: v.string(),
    config: roomConfig,
    members: v.array(roomMember),
    gameState: v.optional(v.any()),
    lastMoveAt: v.number(),
    lastTouchedAt: v.optional(v.number()),
    turnDeadlineAt: v.optional(v.number()),
    turnClockPlayerId: v.optional(v.string()),
    turnTimerSeconds: v.optional(v.number()),
    recentReaction: v.optional(recentReaction),
    returnWindow: v.optional(returnWindow),
    pendingReveal: v.optional(pendingReveal),
    economy: v.optional(
      v.object({
        roundVersion: v.number(),
        buyInsCharged: v.boolean(),
        settled: v.boolean(),
      }),
    ),
    version: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_lastMoveAt", ["lastMoveAt"])
    .index("by_lastTouchedAt", ["lastTouchedAt"]),
  wallets: defineTable({
    userId: v.string(),
    goldBalance: v.number(),
    creditBalance: v.optional(v.number()),
    updatedAt: v.number(),
    lastReason: v.optional(v.string()),
    lastWinAwardRoomId: v.optional(v.id("rooms")),
    lastCreditAwardRoomId: v.optional(v.id("rooms")),
  }).index("by_userId", ["userId"]),
});
