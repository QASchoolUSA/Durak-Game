import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  isAnonymousUser,
  requireStableUserId,
  requireUserId,
} from "./lib/requireAuth";

const UPGRADE_TTL_MS = 10 * 60 * 1000;

/** Snapshot the current identity so the client can show account state. */
export const getAccountStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireStableUserId(ctx);
    const user = await ctx.db.get(userId);
    return {
      userId,
      isAnonymous: isAnonymousUser(user),
      email: (user as { email?: string } | null)?.email ?? null,
    };
  },
});

/**
 * Called while still signed in anonymously, right before launching a sign-in
 * flow. Mints a one-time token bound to this (anonymous) session. Possessing
 * the token proves the caller controlled the guest account, so redeeming it
 * after sign-in can safely transfer that account's data.
 */
export const beginGuestUpgrade = mutation({
  args: {},
  handler: async (ctx) => {
    const fromUserId = await requireStableUserId(ctx);
    const fromSubject = await requireUserId(ctx);
    const token = crypto.randomUUID();
    const now = Date.now();
    await ctx.db.insert("guestUpgrades", {
      token,
      fromUserId,
      fromSubject,
      createdAt: now,
      expiresAt: now + UPGRADE_TTL_MS,
    });
    return { token };
  },
});

/** Redeemed after sign-in (as the new account) to absorb the guest's data. */
export const completeGuestUpgrade = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const newUserId = await requireStableUserId(ctx);
    const newSubject = await requireUserId(ctx);

    const upgrade = await ctx.db
      .query("guestUpgrades")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!upgrade) return { migrated: false };
    if (upgrade.expiresAt < Date.now()) {
      await ctx.db.delete(upgrade._id);
      return { migrated: false };
    }
    const { fromUserId, fromSubject } = upgrade;

    // Same user id means the new auth token hasn't propagated yet (or we're
    // already this account). Leave the token so the client can retry.
    if (fromUserId === newUserId) return { migrated: false };

    await ctx.db.delete(upgrade._id);

    await migrateWallet(ctx, fromSubject, newSubject);
    await migrateProfile(ctx, fromUserId, newUserId);
    await migrateFriendships(ctx, fromUserId, newUserId);
    await migrateInvites(ctx, fromUserId, newUserId);
    await migratePushTokens(ctx, fromUserId, newUserId);

    return { migrated: true };
  },
});

async function migrateWallet(ctx: any, fromSubject: string, toSubject: string) {
  const fromWallet = await ctx.db
    .query("wallets")
    .withIndex("by_userId", (q: any) => q.eq("userId", fromSubject))
    .first();
  if (!fromWallet) return;
  const toWallet = await ctx.db
    .query("wallets")
    .withIndex("by_userId", (q: any) => q.eq("userId", toSubject))
    .first();
  if (!toWallet) {
    await ctx.db.patch(fromWallet._id, { userId: toSubject, updatedAt: Date.now() });
    return;
  }
  // Merge balances into the existing destination wallet.
  await ctx.db.patch(toWallet._id, {
    goldBalance: (toWallet.goldBalance ?? 0) + (fromWallet.goldBalance ?? 0),
    creditBalance: (toWallet.creditBalance ?? 0) + (fromWallet.creditBalance ?? 0),
    updatedAt: Date.now(),
  });
  await ctx.db.delete(fromWallet._id);
}

async function migrateProfile(
  ctx: any,
  fromUserId: Id<"users">,
  toUserId: Id<"users">,
) {
  const fromProfile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", fromUserId))
    .unique();
  if (!fromProfile) return;
  const toProfile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", toUserId))
    .unique();
  if (toProfile) {
    // Destination already has a handle; drop the guest profile.
    await ctx.db.delete(fromProfile._id);
    return;
  }
  await ctx.db.patch(fromProfile._id, { userId: toUserId, updatedAt: Date.now() });
}

async function migrateFriendships(
  ctx: any,
  fromUserId: Id<"users">,
  toUserId: Id<"users">,
) {
  const asRequester = await ctx.db
    .query("friendships")
    .withIndex("by_requester", (q: any) => q.eq("requesterId", fromUserId))
    .collect();
  for (const f of asRequester) {
    if (f.recipientId === toUserId) await ctx.db.delete(f._id);
    else await ctx.db.patch(f._id, { requesterId: toUserId });
  }
  const asRecipient = await ctx.db
    .query("friendships")
    .withIndex("by_recipient", (q: any) => q.eq("recipientId", fromUserId))
    .collect();
  for (const f of asRecipient) {
    if (f.requesterId === toUserId) await ctx.db.delete(f._id);
    else await ctx.db.patch(f._id, { recipientId: toUserId });
  }
}

async function migrateInvites(
  ctx: any,
  fromUserId: Id<"users">,
  toUserId: Id<"users">,
) {
  const all = await ctx.db.query("gameInvites").collect();
  for (const invite of all) {
    const patch: Record<string, unknown> = {};
    if (invite.fromUserId === fromUserId) patch.fromUserId = toUserId;
    if (invite.toUserId === fromUserId) patch.toUserId = toUserId;
    if (Object.keys(patch).length > 0) await ctx.db.patch(invite._id, patch);
  }
}

async function migratePushTokens(
  ctx: any,
  fromUserId: Id<"users">,
  toUserId: Id<"users">,
) {
  const tokens = await ctx.db
    .query("pushTokens")
    .withIndex("by_userId", (q: any) => q.eq("userId", fromUserId))
    .collect();
  for (const t of tokens) {
    await ctx.db.patch(t._id, { userId: toUserId, updatedAt: Date.now() });
  }
}

/**
 * Permanently deletes the authenticated user's account and all associated
 * data across the system (profile, handle, friendships, invites, push tokens,
 * wallet, auth accounts, auth sessions, and user record).
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireStableUserId(ctx);
    const subject = await requireUserId(ctx);

    // 1. Release handle by deleting the public profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile) {
      await ctx.db.delete(profile._id);
    }

    // 2. Delete wallet documents for both session subject and user id
    const wallets = await ctx.db
      .query("wallets")
      .filter((q) =>
        q.or(
          q.eq(q.field("userId"), subject),
          q.eq(q.field("userId"), String(userId)),
        ),
      )
      .collect();
    for (const w of wallets) {
      await ctx.db.delete(w._id);
    }

    // 3. Delete friendships (both sent and received)
    const asRequester = await ctx.db
      .query("friendships")
      .withIndex("by_requester", (q) => q.eq("requesterId", userId))
      .collect();
    for (const f of asRequester) {
      await ctx.db.delete(f._id);
    }
    const asRecipient = await ctx.db
      .query("friendships")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .collect();
    for (const f of asRecipient) {
      await ctx.db.delete(f._id);
    }

    // 4. Delete invites
    const invites = await ctx.db.query("gameInvites").collect();
    for (const invite of invites) {
      if (invite.fromUserId === userId || invite.toUserId === userId) {
        await ctx.db.delete(invite._id);
      }
    }

    // 5. Delete push tokens
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const t of tokens) {
      await ctx.db.delete(t._id);
    }

    // 6. Delete guest upgrade tokens
    const upgrades = await ctx.db
      .query("guestUpgrades")
      .filter((q) => q.eq(q.field("fromUserId"), userId))
      .collect();
    for (const u of upgrades) {
      await ctx.db.delete(u._id);
    }

    // 7. Delete auth accounts and their verification codes
    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const acc of authAccounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", acc._id))
        .collect();
      for (const c of codes) {
        await ctx.db.delete(c._id);
      }
      await ctx.db.delete(acc._id);
    }

    // 8. Delete auth sessions and refresh tokens
    const authSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of authSessions) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
        .collect();
      for (const rt of refreshTokens) {
        await ctx.db.delete(rt._id);
      }
      const verifiers = await ctx.db
        .query("authVerifiers")
        .filter((q) => q.eq(q.field("sessionId"), s._id))
        .collect();
      for (const v of verifiers) {
        await ctx.db.delete(v._id);
      }
      await ctx.db.delete(s._id);
    }

    // 9. Delete the canonical user record
    await ctx.db.delete(userId);

    return { deleted: true };
  },
});

