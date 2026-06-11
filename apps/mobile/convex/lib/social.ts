import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type RelationStatus =
  | "none"
  | "friends"
  | "incoming" // they requested me
  | "outgoing"; // I requested them

export async function getProfileByUserId(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<Doc<"profiles"> | null> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

/** Find the friendship row between two users in either direction. */
export async function findFriendship(
  ctx: Ctx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<Doc<"friendships"> | null> {
  const forward = await ctx.db
    .query("friendships")
    .withIndex("by_pair", (q) => q.eq("requesterId", a).eq("recipientId", b))
    .unique();
  if (forward) return forward;
  return await ctx.db
    .query("friendships")
    .withIndex("by_pair", (q) => q.eq("requesterId", b).eq("recipientId", a))
    .unique();
}

/** Relationship of `other` from the perspective of `me`. */
export function relationFor(
  me: Id<"users">,
  friendship: Doc<"friendships"> | null,
): RelationStatus {
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "friends";
  // pending
  return friendship.requesterId === me ? "outgoing" : "incoming";
}

export type PublicProfile = {
  userId: Id<"users">;
  handle: string;
  displayName: string;
};

export function toPublicProfile(profile: Doc<"profiles">): PublicProfile {
  return {
    userId: profile.userId,
    handle: profile.handle,
    displayName: profile.displayName,
  };
}
