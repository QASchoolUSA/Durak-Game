import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireStableUserId } from "./lib/requireAuth";
import { normalizeDisplayName } from "./lib/displayName";
import {
  findFriendship,
  getProfileByUserId,
  relationFor,
  toPublicProfile,
  type PublicProfile,
  type RelationStatus,
} from "./lib/social";

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
const HANDLE_RE = /^[a-z0-9_]+$/;
const SEARCH_LIMIT = 20;

/** Normalize a raw handle to its canonical lowercase form, or throw. */
function normalizeHandle(raw: string): { handle: string; handleLower: string } {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower.length < HANDLE_MIN || lower.length > HANDLE_MAX) {
    throw new Error(
      `Handle must be ${HANDLE_MIN}-${HANDLE_MAX} characters.`,
    );
  }
  if (!HANDLE_RE.test(lower)) {
    throw new Error("Handle can only use letters, numbers, and underscores.");
  }
  return { handle: trimmed, handleLower: lower };
}

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireStableUserId(ctx);
    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) return null;
    return {
      userId: profile.userId,
      handle: profile.handle,
      displayName: profile.displayName,
    };
  },
});

export const setHandle = mutation({
  args: { handle: v.string(), displayName: v.optional(v.string()) },
  handler: async (ctx, { handle, displayName }) => {
    const userId = await requireStableUserId(ctx);
    const { handle: nextHandle, handleLower } = normalizeHandle(handle);

    const taken = await ctx.db
      .query("profiles")
      .withIndex("by_handleLower", (q) => q.eq("handleLower", handleLower))
      .unique();
    if (taken && taken.userId !== userId) {
      throw new Error("That handle is taken.");
    }

    const existing = await getProfileByUserId(ctx, userId);
    const now = Date.now();
    const resolvedName = normalizeDisplayName(
      displayName?.trim() || existing?.displayName || nextHandle,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        handle: nextHandle,
        handleLower,
        displayName: resolvedName,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        handle: nextHandle,
        handleLower,
        displayName: resolvedName,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { handle: nextHandle, displayName: resolvedName };
  },
});

/**
 * Sync a custom display name onto the profile so friends/invites show it.
 * No-op when no profile exists — `setHandle` is the sole profile creator and
 * the rest of the code assumes `handle` is always present.
 */
export const updateMyDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    const userId = await requireStableUserId(ctx);
    const normalized = normalizeDisplayName(displayName.trim());
    if (!normalized) throw new Error("Display name cannot be empty.");
    const profile = await getProfileByUserId(ctx, userId);
    if (!profile) return null;
    if (profile.displayName !== normalized) {
      await ctx.db.patch(profile._id, {
        displayName: normalized,
        updatedAt: Date.now(),
      });
    }
    return { displayName: normalized };
  },
});

export const searchByHandle = query({
  args: { query: v.string() },
  handler: async (ctx, { query: raw }) => {
    const userId = await requireStableUserId(ctx);
    const prefix = raw.trim().toLowerCase();
    if (prefix.length === 0) return [];

    const matches = await ctx.db
      .query("profiles")
      .withIndex("by_handleLower", (q) =>
        q.gte("handleLower", prefix).lt("handleLower", `${prefix}￿`),
      )
      .take(SEARCH_LIMIT + 1);

    const results: (PublicProfile & { relation: RelationStatus })[] = [];
    for (const profile of matches) {
      if (profile.userId === userId) continue;
      const friendship = await findFriendship(ctx, userId, profile.userId);
      results.push({
        ...toPublicProfile(profile),
        relation: relationFor(userId, friendship),
      });
      if (results.length >= SEARCH_LIMIT) break;
    }
    return results;
  },
});

export const getProfiles = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    await requireStableUserId(ctx);
    const out: Record<Id<"users">, PublicProfile> = {};
    for (const id of userIds) {
      const profile = await getProfileByUserId(ctx, id);
      if (profile) out[id] = toPublicProfile(profile);
    }
    return out;
  },
});
