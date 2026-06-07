import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireUserId(ctx: AuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}
