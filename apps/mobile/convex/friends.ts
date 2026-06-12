import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStableUserId } from "./lib/requireAuth";
import { getProfileByUserId, findFriendship } from "./lib/social";
import { notifyUser } from "./push";

type FriendEntry = {
  friendshipId: Id<"friendships">;
  userId: Id<"users">;
  handle: string;
  displayName: string;
  createdAt: number;
};

async function toEntry(
  ctx: Parameters<typeof getProfileByUserId>[0],
  friendship: Doc<"friendships">,
  otherId: Id<"users">,
): Promise<FriendEntry | null> {
  const profile = await getProfileByUserId(ctx, otherId);
  if (!profile) return null;
  return {
    friendshipId: friendship._id,
    userId: otherId,
    handle: profile.handle,
    displayName: profile.displayName,
    createdAt: friendship.createdAt,
  };
}

export const sendRequest = mutation({
  args: { toUserId: v.id("users") },
  handler: async (ctx, { toUserId }) => {
    const me = await requireStableUserId(ctx);
    if (toUserId === me) throw new Error("You can't add yourself.");

    const target = await getProfileByUserId(ctx, toUserId);
    if (!target) throw new Error("Player not found.");

    const existing = await findFriendship(ctx, me, toUserId);
    if (existing) {
      if (existing.status === "accepted") return { status: "friends" as const };
      if (existing.requesterId === me) return { status: "outgoing" as const };
      // They already requested me -> accept it.
      await ctx.db.patch(existing._id, {
        status: "accepted",
        respondedAt: Date.now(),
      });
      await notifyMyProfileTo(ctx, me, existing.requesterId, "accepted");
      return { status: "friends" as const };
    }

    await ctx.db.insert("friendships", {
      requesterId: me,
      recipientId: toUserId,
      status: "pending",
      createdAt: Date.now(),
    });
    await notifyMyProfileTo(ctx, me, toUserId, "request");
    return { status: "outgoing" as const };
  },
});

async function notifyMyProfileTo(
  ctx: any,
  me: Id<"users">,
  to: Id<"users">,
  kind: "request" | "accepted",
): Promise<void> {
  const mine = await getProfileByUserId(ctx, me);
  const name = mine?.displayName ?? mine?.handle ?? "Someone";
  if (kind === "request") {
    await notifyUser(ctx, to, {
      title: "New friend request",
      body: `${name} wants to be friends`,
      data: { type: "friend_request" },
    });
  } else {
    await notifyUser(ctx, to, {
      title: "Friend request accepted",
      body: `${name} accepted your friend request`,
      data: { type: "friend_accept" },
    });
  }
}

export const acceptRequest = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, { friendshipId }) => {
    const me = await requireStableUserId(ctx);
    const friendship = await ctx.db.get(friendshipId);
    if (!friendship) throw new Error("Request not found.");
    if (friendship.recipientId !== me || friendship.status !== "pending") {
      throw new Error("Request not found.");
    }
    await ctx.db.patch(friendshipId, {
      status: "accepted",
      respondedAt: Date.now(),
    });
    await notifyMyProfileTo(ctx, me, friendship.requesterId, "accepted");
  },
});

export const declineRequest = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, { friendshipId }) => {
    const me = await requireStableUserId(ctx);
    const friendship = await ctx.db.get(friendshipId);
    if (!friendship) return;
    if (friendship.recipientId !== me || friendship.status !== "pending") {
      throw new Error("Request not found.");
    }
    await ctx.db.delete(friendshipId);
  },
});

export const cancelRequest = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, { friendshipId }) => {
    const me = await requireStableUserId(ctx);
    const friendship = await ctx.db.get(friendshipId);
    if (!friendship) return;
    if (friendship.requesterId !== me || friendship.status !== "pending") {
      throw new Error("Request not found.");
    }
    await ctx.db.delete(friendshipId);
  },
});

export const removeFriend = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, { friendshipId }) => {
    const me = await requireStableUserId(ctx);
    const friendship = await ctx.db.get(friendshipId);
    if (!friendship) return;
    if (friendship.requesterId !== me && friendship.recipientId !== me) {
      throw new Error("Not allowed.");
    }
    await ctx.db.delete(friendshipId);
  },
});

export const listFriends = query({
  args: {},
  handler: async (ctx): Promise<FriendEntry[]> => {
    const me = await requireStableUserId(ctx);
    const asRequester = await ctx.db
      .query("friendships")
      .withIndex("by_requester", (q) => q.eq("requesterId", me))
      .collect();
    const asRecipient = await ctx.db
      .query("friendships")
      .withIndex("by_recipient", (q) => q.eq("recipientId", me))
      .collect();

    const entries: FriendEntry[] = [];
    for (const f of [...asRequester, ...asRecipient]) {
      if (f.status !== "accepted") continue;
      const otherId = f.requesterId === me ? f.recipientId : f.requesterId;
      const entry = await toEntry(ctx, f, otherId);
      if (entry) entries.push(entry);
    }
    entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return entries;
  },
});

export const incomingRequests = query({
  args: {},
  handler: async (ctx): Promise<FriendEntry[]> => {
    const me = await requireStableUserId(ctx);
    const rows = await ctx.db
      .query("friendships")
      .withIndex("by_recipient", (q) => q.eq("recipientId", me))
      .collect();
    const entries: FriendEntry[] = [];
    for (const f of rows) {
      if (f.status !== "pending") continue;
      const entry = await toEntry(ctx, f, f.requesterId);
      if (entry) entries.push(entry);
    }
    entries.sort((a, b) => b.createdAt - a.createdAt);
    return entries;
  },
});

export const outgoingRequests = query({
  args: {},
  handler: async (ctx): Promise<FriendEntry[]> => {
    const me = await requireStableUserId(ctx);
    const rows = await ctx.db
      .query("friendships")
      .withIndex("by_requester", (q) => q.eq("requesterId", me))
      .collect();
    const entries: FriendEntry[] = [];
    for (const f of rows) {
      if (f.status !== "pending") continue;
      const entry = await toEntry(ctx, f, f.recipientId);
      if (entry) entries.push(entry);
    }
    entries.sort((a, b) => b.createdAt - a.createdAt);
    return entries;
  },
});
