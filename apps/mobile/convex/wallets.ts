import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  GRAVEYARD_GOLD_COST,
  MATCH_BUY_IN,
  MAX_CREDIT_MIGRATION,
  MAX_WALLET_MIGRATION,
  REVEAL_GOLD_COST,
  STARTING_CREDITS,
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

function resolveCreditBalance(wallet: { creditBalance?: number } | null | undefined): number {
  return wallet?.creditBalance ?? STARTING_CREDITS;
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

async function deductCredits(
  ctx: { db: any },
  userId: string,
  amount: number,
  reason: string,
): Promise<number> {
  const cost = Math.max(0, Math.floor(amount));
  const wallet = await getWalletDoc(ctx, userId);
  if (!wallet) {
    throw new Error("Wallet not found");
  }

  const balance = resolveCreditBalance(wallet);
  if (cost > 0 && balance < cost) {
    throw new Error("Not enough credits");
  }

  const creditBalance = balance - cost;
  await ctx.db.patch(wallet._id, {
    creditBalance,
    updatedAt: Date.now(),
    lastReason: reason,
  });
  return creditBalance;
}

async function awardCredits(
  ctx: { db: any },
  userId: string,
  amount: number,
  reason: string,
): Promise<number> {
  const wallet = await getWalletDoc(ctx, userId);
  if (!wallet) {
    throw new Error("Wallet not found");
  }

  const creditBalance = resolveCreditBalance(wallet) + Math.max(0, Math.floor(amount));
  await ctx.db.patch(wallet._id, {
    creditBalance,
    updatedAt: Date.now(),
    lastReason: reason,
  });
  return creditBalance;
}

type RoomMemberLike = { userId: string; isBot: boolean };

/** Deduct buy-in from every human in the room before a round starts. */
export async function chargeMatchBuyIns(
  ctx: { db: any },
  members: RoomMemberLike[],
): Promise<void> {
  for (const member of members) {
    if (member.isBot) continue;
    await deductCredits(ctx, member.userId, MATCH_BUY_IN, "buy_in");
  }
}

type FinishedGameState = {
  phase: string;
  finishedOrder: string[];
  loserId: string | null;
};

type RoomForSettlement = {
  config: { numPlayers: number };
  members: Array<{ userId: string; isBot: boolean; playerId?: string }>;
  economy?: { buyInsCharged?: boolean; settled?: boolean } | null;
};

/** Award pot or refund buy-ins when a match ends (online, server-authoritative). */
export async function settleMatchEconomy(
  ctx: { db: any },
  room: RoomForSettlement,
  state: FinishedGameState,
): Promise<void> {
  if (state.phase !== "gameOver") return;
  if (!room.economy?.buyInsCharged || room.economy.settled) return;

  const humans = room.members.filter((m) => !m.isBot);

  if (state.loserId === null) {
    for (const member of humans) {
      await awardCredits(ctx, member.userId, MATCH_BUY_IN, "draw_refund");
    }
    return;
  }

  const winnerPlayerId = state.finishedOrder[0];
  const winnerMember = room.members.find(
    (m) => !m.isBot && m.playerId === winnerPlayerId,
  );
  if (!winnerMember) return;

  const pot = MATCH_BUY_IN * room.config.numPlayers;
  await awardCredits(ctx, winnerMember.userId, pot, "win_pot");
}

export const getWallet = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const wallet = await getWalletDoc(ctx, userId);
    return {
      goldBalance: wallet?.goldBalance ?? null,
      creditBalance: wallet ? resolveCreditBalance(wallet) : null,
    };
  },
});

export const ensureWallet = mutation({
  args: {
    localGoldBalance: v.optional(v.number()),
    localCreditBalance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await getWalletDoc(ctx, userId);
    if (existing) {
      const patch: Record<string, number> = {};
      if (existing.creditBalance == null) {
        const migrated = Math.min(
          MAX_CREDIT_MIGRATION,
          Math.max(
            STARTING_CREDITS,
            Math.floor(args.localCreditBalance ?? STARTING_CREDITS),
          ),
        );
        patch.creditBalance = migrated;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() });
      }
      const updated = await getWalletDoc(ctx, userId);
      return {
        goldBalance: updated!.goldBalance,
        creditBalance: resolveCreditBalance(updated),
      };
    }

    const goldBalance = Math.min(
      MAX_WALLET_MIGRATION,
      Math.max(STARTING_GOLD, Math.floor(args.localGoldBalance ?? STARTING_GOLD)),
    );
    const creditBalance = Math.min(
      MAX_CREDIT_MIGRATION,
      Math.max(STARTING_CREDITS, Math.floor(args.localCreditBalance ?? STARTING_CREDITS)),
    );

    await ctx.db.insert("wallets", {
      userId,
      goldBalance,
      creditBalance,
      updatedAt: Date.now(),
    });

    return { goldBalance, creditBalance };
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

async function assertWinner(
  ctx: { db: any },
  userId: string,
  roomId: any,
) {
  const room = await ctx.db.get(roomId);
  if (!room || room.status !== "finished" || !room.gameState) {
    throw new Error("Game not finished");
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
    throw new Error("Only the winner earns rewards");
  }

  return { room, wallet: await getWalletDoc(ctx, userId) };
}

export const awardWinGold = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { wallet } = await assertWinner(ctx, userId, args.roomId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.lastWinAwardRoomId === args.roomId) {
      return { goldBalance: wallet.goldBalance, awarded: 0 };
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

export const awardWinCredits = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { room, wallet } = await assertWinner(ctx, userId, args.roomId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.lastCreditAwardRoomId === args.roomId) {
      return {
        creditBalance: resolveCreditBalance(wallet),
        awarded: 0,
      };
    }

    const pot = MATCH_BUY_IN * room.config.numPlayers;
    const creditBalance = resolveCreditBalance(wallet) + pot;
    await ctx.db.patch(wallet._id, {
      creditBalance,
      updatedAt: Date.now(),
      lastReason: "win_pot",
      lastCreditAwardRoomId: args.roomId,
    });

    return { creditBalance, awarded: pot };
  },
});

export { deductGold, deductCredits, GRAVEYARD_GOLD_COST, REVEAL_GOLD_COST };
