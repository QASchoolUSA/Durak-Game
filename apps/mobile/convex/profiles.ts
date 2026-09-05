import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireRegisteredUserId, requireStableUserId } from "./lib/requireAuth";
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
    };
  },
});

export const setHandle = mutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const userId = await requireRegisteredUserId(ctx);
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

    if (existing) {
      // Replace so a legacy displayName field is dropped from the document.
      await ctx.db.replace(existing._id, {
        userId: existing.userId,
        handle: nextHandle,
        handleLower,
        createdAt: existing.createdAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        handle: nextHandle,
        handleLower,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { handle: nextHandle };
  },
});

export const checkHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    try {
      const { handleLower } = normalizeHandle(handle);
      const taken = await ctx.db
        .query("profiles")
        .withIndex("by_handleLower", (q) => q.eq("handleLower", handleLower))
        .unique();
      return { ok: true, available: !taken };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid handle." };
    }
  },
});

/**
 * One-shot: strip legacy `displayName` from profile documents so the
 * handle-only schema validates. Safe to re-run.
 */
export const stripLegacyDisplayNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    let stripped = 0;
    for (const profile of profiles) {
      if (!("displayName" in profile)) continue;
      await ctx.db.replace(profile._id, {
        userId: profile.userId,
        handle: profile.handle,
        handleLower: profile.handleLower,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      });
      stripped += 1;
    }
    return { stripped };
  },
});

export const searchByHandle = query({
  args: { query: v.string() },
  handler: async (ctx, { query: raw }) => {
    const userId = await requireRegisteredUserId(ctx);
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
