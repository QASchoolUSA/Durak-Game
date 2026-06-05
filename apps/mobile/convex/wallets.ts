import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  GRAVEYARD_GOLD_COST,
  MAX_WALLET_MIGRATION,
  REVEAL_GOLD_COST,
  STARTING_GOLD,
  WIN_GOLD_REWARD,
} from "./lib/goldEconomy";
import { requireUserId } from "./lib/requireAuth";

async function getWalletDoc(ctx: { db: any }, userId: string) {
  return await ctx.db
    .query("wallets")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .first();
}

async function deductGold(
  ctx: { db: any },
  userId: string,
  amount: number,
  reason: string,
): Promise<number> {
  if (amount <= 0) {
    const wallet = await getWalletDoc(ctx, userId);
    return wallet?.goldBalance ?? STARTING_GOLD;
  }

  const wallet = await getWalletDoc(ctx, userId);
  if (!wallet || wallet.goldBalance < amount) {
    throw new Error("Not enough gold");
  }

  const goldBalance = wallet.goldBalance - amount;
  await ctx.db.patch(wallet._id, {
    goldBalance,
    updatedAt: Date.now(),
    lastReason: reason,
  });
  return goldBalance;
}

export const getWallet = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const wallet = await getWalletDoc(ctx, userId);
    return { goldBalance: wallet?.goldBalance ?? null };
  },
});

export const ensureWallet = mutation({
  args: {
    localBalance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await getWalletDoc(ctx, userId);
    if (existing) {
      return { goldBalance: existing.goldBalance };
    }

    const migrated = Math.min(
      MAX_WALLET_MIGRATION,
      Math.max(STARTING_GOLD, Math.floor(args.localBalance ?? STARTING_GOLD)),
    );

    await ctx.db.insert("wallets", {
      userId,
      goldBalance: migrated,
      updatedAt: Date.now(),
    });

    return { goldBalance: migrated };
  },
});

export const spendGold = mutation({
  args: {
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const goldBalance = await deductGold(ctx, userId, args.amount, args.reason);
    return { goldBalance };
  },
});

export const awardGold = mutation({
  args: {
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const wallet = await getWalletDoc(ctx, userId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const goldBalance = wallet.goldBalance + Math.max(0, Math.floor(args.amount));
    await ctx.db.patch(wallet._id, {
      goldBalance,
      updatedAt: Date.now(),
      lastReason: args.reason,
    });
    return { goldBalance };
  },
});

export const awardWinGold = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "finished" || !room.gameState) {
      throw new Error("Game not finished");
    }

    const wallet = await getWalletDoc(ctx, userId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.lastWinAwardRoomId === args.roomId) {
      return { goldBalance: wallet.goldBalance, awarded: 0 };
    }

    const member = room.members.find(
      (m: { userId: string; playerId?: string; isBot: boolean }) =>
        m.userId === userId && !m.isBot,
    );
    if (!member?.playerId) {
      throw new Error("Not a member");
    }

    const state = room.gameState as {
      phase: string;
      finishedOrder: string[];
      loserId: string | null;
    };

    if (state.phase !== "gameOver" || state.loserId === null) {
      throw new Error("No winner");
    }

    if (state.finishedOrder[0] !== member.playerId) {
      throw new Error("Only the winner earns gold");
    }

    const goldBalance = wallet.goldBalance + WIN_GOLD_REWARD;
    await ctx.db.patch(wallet._id, {
      goldBalance,
      updatedAt: Date.now(),
      lastReason: "win",
      lastWinAwardRoomId: args.roomId,
    });

    return { goldBalance, awarded: WIN_GOLD_REWARD };
  },
});

export { deductGold, GRAVEYARD_GOLD_COST, REVEAL_GOLD_COST };
