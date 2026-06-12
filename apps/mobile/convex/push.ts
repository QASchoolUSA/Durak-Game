import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { requireStableUserId } from "./lib/requireAuth";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const platformValidator = v.union(v.literal("ios"), v.literal("android"));

/** Client registers (or refreshes) its Expo push token after sign-in. */
export const registerPushToken = mutation({
  args: { token: v.string(), platform: platformValidator },
  handler: async (ctx, { token, platform }) => {
    const userId = await requireStableUserId(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (existing) {
      if (existing.userId !== userId || existing.platform !== platform) {
        await ctx.db.patch(existing._id, { userId, platform, updatedAt: now });
      } else {
        await ctx.db.patch(existing._id, { updatedAt: now });
      }
      return;
    }
    await ctx.db.insert("pushTokens", { userId, token, platform, updatedAt: now });
  },
});

export const removePushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireStableUserId(ctx);
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const tokensForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => r.token);
  },
});

export const deleteTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, { tokens }) => {
    for (const token of tokens) {
      const existing = await ctx.db
        .query("pushTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (existing) await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Send a push to every device a user has registered. Scheduled from mutations
 * (`ctx.scheduler.runAfter(0, internal.push.sendToUser, ...)`). Does network
 * I/O, so it must be an action. Prunes tokens Expo reports as unregistered.
 */
export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { userId, title, body, data }) => {
    const tokens: string[] = await ctx.runQuery(internal.push.tokensForUser, {
      userId,
    });
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      data: data ?? {},
      sound: "default" as const,
    }));

    let receipts: any;
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      receipts = await res.json();
    } catch (err) {
      console.warn("[push] send failed", err);
      return;
    }

    // Prune tokens Expo can no longer deliver to.
    const tickets: any[] = Array.isArray(receipts?.data) ? receipts.data : [];
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (
        ticket?.status === "error" &&
        ticket?.details?.error === "DeviceNotRegistered" &&
        tokens[i]
      ) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length > 0) {
      await ctx.runMutation(internal.push.deleteTokens, { tokens: dead });
    }
  },
});

export async function notifyUser(
  ctx: { scheduler: { runAfter: Function } },
  userId: Id<"users">,
  payload: { title: string; body: string; data?: unknown },
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.push.sendToUser, {
    userId,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  });
}
