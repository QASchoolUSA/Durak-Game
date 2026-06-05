import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated as RNAnimated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useMutation } from "convex/react";
import { Background } from "../components/Background";
import { Confetti } from "../components/Confetti";
import { MenuButton } from "../components/MenuButton";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useGameStore, awardWinGoldLocal } from "../game/store";
import { WIN_GOLD_REWARD } from "../game/goldEconomy";
import { trigger } from "../feedback/haptics";
import { clearRoomSession } from "../game/onlineSessionStorage";
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

// ── Animated prize counter ───────────────────────────────────────────────────

function GoldPrizeCounter({ amount }: { amount: number }) {
  const ui = useUiTheme();
  const animVal = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(animVal, {
      toValue: amount,
      duration: 1200,
      useNativeDriver: false,
      delay: 700,
    }).start();
  }, [amount, animVal]);

  return (
    <View style={styles.prizeRow}>
      <Text style={styles.prizeCoin}>🪙</Text>
      <RNAnimated.Text style={[styles.prizeAmount, { color: colors.gold }]}>
        {animVal.interpolate({
          inputRange: [0, amount],
          outputRange: [`+0`, `+${amount}`],
        })}
      </RNAnimated.Text>
      <Text style={[styles.prizeLabel, { color: ui.textMuted }]}> gold</Text>
    </View>
  );
}

function PrizeCounter({ amount }: { amount: number }) {
  const ui = useUiTheme();
  const animVal = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(animVal, {
      toValue: amount,
      duration: 1200,
      useNativeDriver: false,
      delay: 600,
    }).start();
  }, [amount, animVal]);

  return (
    <View style={styles.prizeRow}>
      <Text style={styles.prizeCoin}>💰</Text>
      <RNAnimated.Text style={styles.prizeAmount}>
        {animVal.interpolate({
          inputRange: [0, amount],
          outputRange: [`+0`, `+${amount}`],
        })}
      </RNAnimated.Text>
      <Text style={[styles.prizeLabel, { color: ui.textMuted }]}> credits</Text>
    </View>
  );
}

// ── Player row in rankings ───────────────────────────────────────────────────

function RankingRow({
  name,
  rank,
  total,
  isHuman,
  isLoser,
  delay,
}: {
  name:    string;
  rank:    number;
  total:   number;
  isHuman: boolean;
  isLoser: boolean;
  delay:   number;
}) {
  const ui = useUiTheme();
  const badge = rankBadge(rank, total, isLoser, ui.accent);

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(320)}
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
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export function ResultScreen() {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();
  const game       = useGameStore((s) => s.game);
  const humanId    = useGameStore((s) => s.humanId);
  const names      = useGameStore((s) => s.names);
  const pot        = useGameStore((s) => s.pot);
  const numPlayers = useGameStore((s) => s.numPlayers);
  const playMode     = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const startGame  = useGameStore((s) => s.startGame);
  const goHome     = useGameStore((s) => s.goHome);
  const syncGoldBalance = useGameStore((s) => s.syncGoldBalance);
  const { width }  = useWindowDimensions();
  const lay        = layoutFor(width);

  const returnToLobby = useMutation(api.rooms.returnToLobby);
  const awardWinGold = useMutation(api.wallets.awardWinGold);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const [returning, setReturning] = useState(false);

  const handlePlayAgain = useCallback(async () => {
    if (playMode === "online") {
      if (!onlineRoomId || returning) return;
      setReturning(true);
      trigger("confirm");
      try {
        await returnToLobby({
          roomId: onlineRoomId as Id<"rooms">,
        });
      } catch {
        trigger("error");
        setReturning(false);
      }
      return;
    }
    startGame(numPlayers);
  }, [
    playMode,
    onlineRoomId,
    returning,
    returnToLobby,
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

  const loser     = game?.loserId ?? null;
  const humanLost = loser === humanId;
  const isDraw    = loser === null && game?.phase === "gameOver";

  // Build ranked player list: finishedOrder first (best), then loser last
  const finished   = game?.finishedOrder ?? [];
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
    ? { headline: "DRAW",     emoji: "🤝", headlineColor: colors.textMuted }
    : humanLost
      ? { headline: "DURAK!",   emoji: "🃏", headlineColor: colors.lose }
      : { headline: "VICTORY!", emoji: "🏆", headlineColor: ui.accent };

  const humanWon = !humanLost && !isDraw;
  const humanRank1 = (game?.finishedOrder[0] ?? null) === humanId;
  const goldAwardedRef = useRef(false);

  useEffect(() => {
    if (humanWon) trigger("success");
    else if (humanLost) trigger("failure");
  }, [humanWon, humanLost]);

  useEffect(() => {
    if (!humanRank1 || goldAwardedRef.current) return;
    goldAwardedRef.current = true;
    if (playMode === "online" && onlineRoomId) {
      void awardWinGold({
        roomId: onlineRoomId as Id<"rooms">,
      })
        .then((result) => syncGoldBalance(result.goldBalance))
        .catch(() => {
          awardWinGoldLocal();
        });
    } else {
      awardWinGoldLocal();
    }
  }, [
    humanRank1,
    playMode,
    onlineRoomId,
    awardWinGold,
    syncGoldBalance,
  ]);

  return (
    <Background variant="game">
      {humanWon && !reduceMotion && <Confetti />}
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { maxWidth: lay.maxContent }]}>

          {/* ── Hero section ── */}
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(300) : ZoomIn.springify().damping(14)}
            style={styles.hero}
          >
            <Text style={styles.heroEmoji}>{emoji}</Text>
            <Text style={[styles.heroTitle, { color: headlineColor }]}>{headline}</Text>
            {humanWon && (
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
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(250).duration(350)}
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
            {rankings.map((r, idx) => (
              <RankingRow
                key={r.id}
                name={names[r.id] ?? r.id}
                rank={r.rank}
                total={rankings.length}
                isHuman={r.id === humanId}
                isLoser={r.isLoser}
                delay={reduceMotion ? 0 : 300 + idx * 80}
              />
            ))}
          </Animated.View>

          {/* ── Prize counter ── */}
          {humanWon && (
            <Animated.View entering={FadeInDown.delay(500).duration(350)} style={styles.prizeWrap}>
              <PrizeCounter amount={pot} />
              {humanRank1 && <GoldPrizeCounter amount={WIN_GOLD_REWARD} />}
            </Animated.View>
          )}

          {/* ── Actions ── */}
          <Animated.View
            entering={FadeInDown.delay(600).duration(350)}
            style={styles.actions}
          >
            <MenuButton
              label="PLAY AGAIN"
              variant="primary"
              onPress={handlePlayAgain}
              icon="▶"
              disabled={returning}
            />
            <MenuButton
              label="MAIN MENU"
              variant="ghost"
              onPress={handleMainMenu}
              icon="⌂"
            />
          </Animated.View>

        </View>
      </SafeAreaView>
    </Background>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    width: "100%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },

  // Hero
  hero:      { alignItems: "center", gap: spacing.xs },
  heroEmoji: { fontSize: 64, marginBottom: spacing.xs },
  heroTitle: { ...typography.display, textAlign: "center" },
  heroSub:   { ...typography.body, textAlign: "center" },

  // Rankings
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
  rankInfo:  { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  rankName:  { ...typography.body, fontWeight: "700" },
  rankYou:   { ...typography.caption },
  rankBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankBadgeText: { ...typography.label, letterSpacing: 0.8 },

  // Prize
  prizeWrap: { alignItems: "center", gap: spacing.xs },
  prizeRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  prizeCoin: { fontSize: 22 },
  prizeAmount: {
    ...typography.title,
    color: colors.success,
  },
  prizeLabel: { ...typography.body },

  // Actions
  actions: { gap: spacing.sm },
});
