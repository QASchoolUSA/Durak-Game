import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

/**
 * Session-scoped identity (`userId|sessionId`). Used by legacy room/wallet code.
 * Do NOT use for cross-session/cross-user features — it changes per session.
 */
export async function requireUserId(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}

/**
 * Canonical, stable `users._id` for the signed-in account. Use this for
 * profiles, friends, invites, and push tokens — anything that must persist
 * across sessions or be shared between users.
 */
export async function requireStableUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

/** Like {@link requireStableUserId} but returns null instead of throwing. */
export async function getStableUserId(
  ctx: AuthCtx,
): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

/** True when the users row is an anonymous (guest) session. */
export function isAnonymousUser(
  user: Doc<"users"> | null | undefined,
): boolean {
  if (!user) return true;
  const email = (user as { email?: string }).email;
  const flagged = Boolean((user as { isAnonymous?: boolean }).isAnonymous);
  return !email || flagged;
}

/**
 * Stable user id for registered (email/password) accounts only.
 * Guests may create/join rooms by code, but cannot claim handles or use friends.
 */
export async function requireRegisteredUserId(
  ctx: AuthCtx,
): Promise<Id<"users">> {
  const userId = await requireStableUserId(ctx);
  const user = await ctx.db.get(userId);
  if (isAnonymousUser(user)) {
    throw new Error("Create an account to use this feature.");
  }
  return userId;
}
