import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
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
