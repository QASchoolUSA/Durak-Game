import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireStableUserId, requireUserId } from "./lib/requireAuth";
import { findFriendship, getProfileByUserId } from "./lib/social";
import { createRoomForHost } from "./rooms";
import { notifyUser } from "./push";

const INVITE_TTL_MS = 2 * 60 * 1000;

const roomConfigValidator = v.object({
  numPlayers: v.number(),
  variant: v.union(v.literal("podkidnoy"), v.literal("perevodnoy")),
  throwInScope: v.union(v.literal("all"), v.literal("neighbor")),
  playStyle: v.union(v.literal("standard"), v.literal("abilities")),
  difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
});

export const sendInvite = mutation({
  args: {
    toUserId: v.id("users"),
    config: roomConfigValidator,
    displayName: v.string(),
    turnTimerSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { toUserId, config, displayName, turnTimerSeconds }) => {
    const me = await requireStableUserId(ctx);
    const hostSubject = await requireUserId(ctx);
    if (toUserId === me) throw new Error("You can't invite yourself.");

    const friendship = await findFriendship(ctx, me, toUserId);
    if (!friendship || friendship.status !== "accepted") {
      throw new Error("You can only invite friends.");
    }

    const { roomId, code } = await createRoomForHost(ctx, {
      hostUserId: hostSubject,
      displayName,
      config,
      turnTimerSeconds,
    });

    const now = Date.now();
    await ctx.db.insert("gameInvites", {
      fromUserId: me,
      toUserId,
      roomId,
      status: "pending",
      createdAt: now,
      expiresAt: now + INVITE_TTL_MS,
    });

    const mine = await getProfileByUserId(ctx, me);
    const name = mine?.displayName ?? mine?.handle ?? "A friend";
    await notifyUser(ctx, toUserId, {
      title: "Game invite",
      body: `${name} invited you to play Durak`,
      data: { type: "game_invite", roomId, code },
    });

    return { roomId, code };
  },
});

export const acceptInvite = mutation({
  args: { inviteId: v.id("gameInvites") },
  handler: async (ctx, { inviteId }) => {
    const me = await requireStableUserId(ctx);
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.toUserId !== me) {
      throw new Error("Invite not found.");
    }
    if (invite.status !== "pending" || invite.expiresAt < Date.now()) {
      throw new Error("This invite is no longer valid.");
    }
    const room = await ctx.db.get(invite.roomId);
    if (!room || (room.status !== "lobby" && room.status !== "finished")) {
      await ctx.db.patch(inviteId, { status: "expired" });
      throw new Error("This game is no longer available.");
    }
    await ctx.db.patch(inviteId, { status: "accepted" });
    return { roomId: invite.roomId, code: room.code };
  },
});

export const declineInvite = mutation({
  args: { inviteId: v.id("gameInvites") },
  handler: async (ctx, { inviteId }) => {
    const me = await requireStableUserId(ctx);
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.toUserId !== me) return;
    if (invite.status === "pending") {
      await ctx.db.patch(inviteId, { status: "declined" });
    }
  },
});

export const cancelInvite = mutation({
  args: { inviteId: v.id("gameInvites") },
  handler: async (ctx, { inviteId }) => {
    const me = await requireStableUserId(ctx);
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.fromUserId !== me) return;
    if (invite.status === "pending") {
      await ctx.db.patch(inviteId, { status: "canceled" });
    }
  },
});

export type IncomingInvite = {
  inviteId: Id<"gameInvites">;
  roomId: Id<"rooms">;
  code: string;
  roomStatus: string;
  fromUserId: Id<"users">;
  fromHandle: string;
  fromDisplayName: string;
  createdAt: number;
  expiresAt: number;
};

export const incomingInvites = query({
  args: {},
  handler: async (ctx): Promise<IncomingInvite[]> => {
    const me = await requireStableUserId(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query("gameInvites")
      .withIndex("by_toUser_status", (q) =>
        q.eq("toUserId", me).eq("status", "pending"),
      )
      .collect();

    const out: IncomingInvite[] = [];
    for (const invite of rows) {
      if (invite.expiresAt < now) continue;
      const room = await ctx.db.get(invite.roomId);
      if (!room || (room.status !== "lobby" && room.status !== "finished")) {
        continue;
      }
      const fromProfile = await getProfileByUserId(ctx, invite.fromUserId);
      out.push({
        inviteId: invite._id,
        roomId: invite.roomId,
        code: room.code,
        roomStatus: room.status,
        fromUserId: invite.fromUserId,
        fromHandle: fromProfile?.handle ?? "player",
        fromDisplayName: fromProfile?.displayName ?? "A friend",
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      });
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  },
});

/** Cron-driven: mark expired pending invites so they stop showing. */
export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("gameInvites").collect();
    for (const invite of rows) {
      if (invite.status === "pending" && invite.expiresAt < now) {
        await ctx.db.patch(invite._id, { status: "expired" });
      }
    }
  },
});
