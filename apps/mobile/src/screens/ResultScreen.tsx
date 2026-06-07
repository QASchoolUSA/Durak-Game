import React, { useCallback, useEffect, useState } from "react";
import { InteractionManager, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { Background } from "../components/Background";
import { Confetti } from "../components/Confetti";
import { MenuButton } from "../components/MenuButton";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { CoinIcon } from "../components/CoinIcon";
import { useGameStore } from "../game/store";
import { MATCH_BUY_IN } from "../game/creditEconomy";
import { trigger } from "../feedback/haptics";
import { chargeBuyIn } from "../game/chargeBuyIn";
import { convexEnabled } from "../game/convexClient";
import { clearRoomSession } from "../game/onlineSessionStorage";
import { useOnlineAuth } from "../game/useAuthBootstrap";
import { layoutFor, colors, radius, shadows, spacing, typography } from "../theme";
import { useUiTheme } from "../theme/UiThemeContext";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// ── Rank badges ──────────────────────────────────────────────────────────────

const RANK_MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];

function rankBadge(rank: number, total: number, isLoser: boolean, accent: string) {
  if (isLoser) return { emoji: "🃏", label: "DURAK", color: colors.lose };
  if (rank === 1) return { emoji: RANK_MEDALS[0]!, label: "WINNER", color: accent };
  return { emoji: RANK_MEDALS[rank - 1] ?? `${rank}`, label: "FINISHED", color: colors.textMuted };
}

function CreditPrizeDisplay({ amount, label }: { amount: number; label: string }) {
  const ui = useUiTheme();
  const prefix = amount >= 0 ? "+" : "-";
  const displayAmount = Math.abs(amount);

  return (
    <View style={styles.prizeRow}>
      <CoinIcon variant="credit" size={20} />
      <Text
        style={[
          styles.prizeAmount,
          { color: amount >= 0 ? colors.success : colors.lose },
        ]}
      >
        {prefix}
        {displayAmount}
      </Text>
      <Text style={[styles.prizeLabel, { color: ui.textMuted }]}> {label}</Text>
    </View>
  );
}

function RankingRow({
  name,
  rank,
  total,
  isHuman,
  isLoser,
}: {
  name: string;
  rank: number;
  total: number;
  isHuman: boolean;
  isLoser: boolean;
}) {
  const ui = useUiTheme();
  const badge = rankBadge(rank, total, isLoser, ui.accent);

  return (
    <View
      style={[
        styles.rankRow,
        { borderBottomColor: ui.panelBorderSoft },
        isHuman && {
          backgroundColor: ui.accentSoft,
          borderBottomColor: ui.panelBorderSoft,
        },
      ]}
    >
      <Text style={styles.rankMedal}>{badge.emoji}</Text>
      <View style={styles.rankInfo}>
        <Text style={[styles.rankName, { color: ui.textPrimary }, isHuman && { color: ui.accent }]}>
          {name}
        </Text>
        {isHuman && <Text style={[styles.rankYou, { color: ui.accentMuted }]}>(you)</Text>}
      </View>
      <View style={[styles.rankBadge, { borderColor: badge.color }]}>
        <Text style={[styles.rankBadgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>
    </View>
  );
}

export interface ResultScreenProps {
  /** When false, celebration effects wait for the crossfade to finish. */
  celebrateReady?: boolean;
}

export function ResultScreen({ celebrateReady = true }: ResultScreenProps) {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const names = useGameStore((s) => s.names);
  const pot = useGameStore((s) => s.pot);
  const buyIn = useGameStore((s) => s.buyIn);
  const numPlayers = useGameStore((s) => s.numPlayers);
  const playMode = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const onlineIsHost = useGameStore((s) => s.onlineIsHost);
  const { isAuthenticated } = useConvexAuth();
  const startGame = useGameStore((s) => s.startGame);
  const syncCreditBalance = useGameStore((s) => s.syncCreditBalance);
  const deductCreditsLocal = useGameStore((s) => s.deductCreditsLocal);
  const setOnlineStatusMessage = useGameStore((s) => s.setOnlineStatusMessage);
  const goHome = useGameStore((s) => s.goHome);
  const { ensureAuthenticated } = useOnlineAuth();
  const { width } = useWindowDimensions();
  const lay = layoutFor(width);

  const rematch = useMutation(api.rooms.rematch);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const spendCredits = useMutation(api.wallets.spendCredits);
  const [returning, setReturning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const roomView = useQuery(
    api.rooms.getRoomView,
    playMode === "online" && onlineRoomId && isAuthenticated
      ? { roomId: onlineRoomId as Id<"rooms"> }
      : "skip",
  );

  useEffect(() => {
    if (roomView?.status === "playing") {
      setReturning(false);
    }
  }, [roomView?.status]);

  const handlePlayAgain = useCallback(async () => {
    if (playMode === "online") {
      if (!onlineRoomId || returning || !onlineIsHost) return;
      setReturning(true);
      trigger("confirm");
      try {
        await rematch({
          roomId: onlineRoomId as Id<"rooms">,
        });
      } catch {
        trigger("error");
        setReturning(false);
      }
      return;
    }
    const charged = await chargeBuyIn({
      convexEnabled,
      ensureAuthenticated,
      spendCredits,
      buyIn,
      syncCreditBalance,
      deductCreditsLocal,
    });
    if (!charged) {
      setOnlineStatusMessage("Not enough credits.");
      trigger("error");
      return;
    }
    startGame(numPlayers, { buyInCharged: convexEnabled });
  }, [
    playMode,
    onlineRoomId,
    onlineIsHost,
    returning,
    rematch,
    spendCredits,
    buyIn,
    syncCreditBalance,
    deductCreditsLocal,
    ensureAuthenticated,
    setOnlineStatusMessage,
    startGame,
    numPlayers,
  ]);

  const handleMainMenu = useCallback(async () => {
    if (playMode === "online" && onlineRoomId) {
      try {
        await leaveRoom({
          roomId: onlineRoomId as Id<"rooms">,
        });
      } catch {
        /* ignore */
      }
      await clearRoomSession();
    }
    goHome();
  }, [playMode, onlineRoomId, leaveRoom, goHome]);

  const loser = game?.loserId ?? null;
  const humanLost = loser === humanId;
  const isDraw = loser === null && game?.phase === "gameOver";

  const finished = game?.finishedOrder ?? [];
  const allPlayers = game?.players ?? [];
  const rankings = [
    ...finished.map((id, i) => ({ id, rank: i + 1, isLoser: false })),
    ...allPlayers
      .filter((id) => !finished.includes(id))
      .map((id, i) => ({
        id,
        rank: finished.length + i + 1,
        isLoser: id === loser,
      })),
  ];

  const { headline, emoji, headlineColor } = isDraw
    ? { headline: "DRAW", emoji: "🤝", headlineColor: colors.textMuted }
    : humanLost
      ? { headline: "DURAK!", emoji: "🃏", headlineColor: colors.lose }
      : { headline: "VICTORY!", emoji: "🏆", headlineColor: ui.accent };

  const humanRank1 = (game?.finishedOrder[0] ?? null) === humanId;
  const effectiveBuyIn = buyIn || MATCH_BUY_IN;

  const creditPrize =
    isDraw ? effectiveBuyIn
    : humanRank1 ? pot
    : humanLost || finished.includes(humanId) ? -effectiveBuyIn
    : null;

  const creditPrizeLabel =
    isDraw ? "credits returned"
    : humanRank1 ? "credits won"
    : "buy-in lost";

  useEffect(() => {
    if (humanRank1 && !isDraw) trigger("success");
    else if (humanLost) trigger("failure");
  }, [humanRank1, humanLost, isDraw]);

  useEffect(() => {
    if (!humanRank1 || isDraw || reduceMotion || !celebrateReady) {
      setShowConfetti(false);
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => {
      setShowConfetti(true);
    });
    return () => task.cancel();
  }, [humanRank1, isDraw, reduceMotion, celebrateReady]);

  return (
    <Background variant="game">
      {showConfetti && <Confetti />}
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { maxWidth: lay.maxContent }]}>
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>{emoji}</Text>
            <Text style={[styles.heroTitle, { color: headlineColor }]}>{headline}</Text>
            {humanRank1 && !isDraw && (
              <Text style={[styles.heroSub, { color: ui.textMuted }]}>
                {names[loser!] ?? loser} is the fool!
              </Text>
            )}
            {humanLost && (
              <Text style={[styles.heroSub, { color: ui.textMuted }]}>Better luck next round.</Text>
            )}
            {isDraw && (
              <Text style={[styles.heroSub, { color: ui.textMuted }]}>Everyone ran out together.</Text>
            )}
          </View>

          <View
            style={[
              styles.rankingCard,
              {
                backgroundColor: ui.panelBg,
                borderColor: ui.panelBorderSoft,
              },
            ]}
          >
            <Text
              style={[
                styles.rankingHeader,
                {
                  color: ui.textFaint,
                  borderBottomColor: ui.panelBorderSoft,
                },
              ]}
            >
              FINAL STANDINGS
            </Text>
            {rankings.map((r) => (
              <RankingRow
                key={r.id}
                name={names[r.id] ?? r.id}
                rank={r.rank}
                total={rankings.length}
                isHuman={r.id === humanId}
                isLoser={r.isLoser}
              />
            ))}
          </View>

          {creditPrize != null && (
            <View style={styles.prizeWrap}>
              <CreditPrizeDisplay amount={creditPrize} label={creditPrizeLabel} />
            </View>
          )}

          <View style={styles.actions}>
            {playMode === "online" && !onlineIsHost ? (
              <Text style={[styles.waitingHost, { color: ui.textMuted }]}>
                {returning || roomView?.status === "playing"
                  ? "Starting next round…"
                  : "Waiting for host to start the next round…"}
              </Text>
            ) : (
              <MenuButton
                label={playMode === "online" ? "NEXT ROUND" : "PLAY AGAIN"}
                variant="primary"
                onPress={handlePlayAgain}
                icon="▶"
                disabled={returning}
              />
            )}
            <MenuButton
              label="MAIN MENU"
              variant="ghost"
              onPress={handleMainMenu}
              icon="⌂"
            />
          </View>
        </View>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    width: "100%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },

  waitingHost: {
    ...typography.body,
    textAlign: "center",
    paddingVertical: spacing.md,
  },

  hero: { alignItems: "center", gap: spacing.xs },
  heroEmoji: { fontSize: 64, marginBottom: spacing.xs },
  heroTitle: { ...typography.display, textAlign: "center" },
  heroSub: { ...typography.body, textAlign: "center" },

  rankingCard: {
    borderRadius: radius.panel,
    borderWidth: 1,
    overflow: "hidden",
    ...shadows.panel,
  },
  rankingHeader: {
    ...typography.label,
    textAlign: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },
  rankMedal: { fontSize: 22, width: 28 },
  rankInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  rankName: { ...typography.body, fontWeight: "700" },
  rankYou: { ...typography.caption },
  rankBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankBadgeText: { ...typography.label, letterSpacing: 0.8 },

  prizeWrap: { alignItems: "center", gap: spacing.xs },
  prizeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  prizeAmount: {
    ...typography.title,
  },
  prizeLabel: { ...typography.body },

  actions: { gap: spacing.sm },
});
