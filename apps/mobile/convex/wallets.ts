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
  buyIn: number = MATCH_BUY_IN,
): Promise<void> {
  for (const member of members) {
    if (member.isBot) continue;
    await deductCredits(ctx, member.userId, buyIn, "buy_in");
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
  buyIn?: number;
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
  const buyIn = room.buyIn ?? MATCH_BUY_IN;

  if (state.loserId === null) {
    for (const member of humans) {
      await awardCredits(ctx, member.userId, buyIn, "draw_refund");
    }
    return;
  }

  // Prefer first human in finishedOrder (bots may finish first but never paid buy-in).
  const winnerPlayerId = state.finishedOrder.find((playerId) =>
    humans.some((m) => m.playerId === playerId),
  );
  const winnerMember = winnerPlayerId
    ? humans.find((m) => m.playerId === winnerPlayerId)
    : undefined;
  // No human finisher → humans already lost buy-in; nothing to award.
  if (!winnerMember) return;

  // Pot is only human buy-ins (bots never pay).
  const pot = buyIn * humans.length;
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
  handler: async (_ctx, _args) => {
    // Public mint disabled — online rewards settle only via rooms.settleMatchEconomy.
    throw new Error("Gold awards are handled by the server");
  },
});

export const spendCredits = mutation({
  args: {
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const creditBalance = await deductCredits(ctx, userId, args.amount, args.reason);
    return { creditBalance };
  },
});

export const awardCreditsPublic = mutation({
  args: {
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const creditBalance = await awardCredits(ctx, userId, args.amount, args.reason);
    return { creditBalance };
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
    const { room, wallet } = await assertWinner(ctx, userId, args.roomId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // Match pot/gold already settled server-side — do not double-pay.
    if ((room as any).economy?.settled || wallet.lastWinAwardRoomId === args.roomId) {
      return { goldBalance: wallet.goldBalance, awarded: 0 };
    }

    throw new Error("Win gold is settled by the server");
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

    if ((room as any).economy?.settled || wallet.lastCreditAwardRoomId === args.roomId) {
      return {
        creditBalance: resolveCreditBalance(wallet),
        awarded: 0,
      };
    }

    throw new Error("Win credits are settled by the server");
  },
});

export { deductGold, deductCredits, GRAVEYARD_GOLD_COST, REVEAL_GOLD_COST };
