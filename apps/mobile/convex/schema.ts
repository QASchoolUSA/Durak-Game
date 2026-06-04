import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const roomConfig = v.object({
  numPlayers: v.number(),
  variant: v.union(v.literal("podkidnoy"), v.literal("perevodnoy")),
  throwInScope: v.union(v.literal("all"), v.literal("neighbor")),
  playStyle: v.union(v.literal("standard"), v.literal("abilities")),
  difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
});

const roomMember = v.object({
  sessionToken: v.string(),
  displayName: v.string(),
  seatIndex: v.number(),
  isBot: v.boolean(),
  playerId: v.optional(v.string()),
  isReady: v.optional(v.boolean()),
});

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    status: v.union(v.literal("lobby"), v.literal("playing"), v.literal("finished")),
    hostSessionToken: v.string(),
    config: roomConfig,
    members: v.array(roomMember),
    gameState: v.optional(v.any()),
    lastMoveAt: v.number(),
    version: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_lastMoveAt", ["lastMoveAt"]),
});
