import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated as RNAnimated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { Background } from "../components/Background";
import { Confetti } from "../components/Confetti";
import { MenuButton } from "../components/MenuButton";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { CoinIcon } from "../components/CoinIcon";
import { useGameStore } from "../game/store";
import { MATCH_BUY_IN } from "../game/creditEconomy";
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

function CreditPrizeCounter({ amount, label }: { amount: number; label: string }) {
  const ui = useUiTheme();
  const animVal = useRef(new RNAnimated.Value(0)).current;
  const displayAmount = Math.abs(amount);
  const prefix = amount >= 0 ? "+" : "-";

  useEffect(() => {
    RNAnimated.timing(animVal, {
      toValue: displayAmount,
      duration: 1200,
      useNativeDriver: false,
      delay: 600,
    }).start();
  }, [displayAmount, animVal]);

  return (
    <View style={styles.prizeRow}>
      <CoinIcon variant="credit" size={20} />
      <RNAnimated.Text
        style={[
          styles.prizeAmount,
          { color: amount >= 0 ? colors.success : colors.lose },
        ]}
      >
        {animVal.interpolate({
          inputRange: [0, displayAmount],
          outputRange: [`${prefix}0`, `${prefix}${displayAmount}`],
        })}
      </RNAnimated.Text>
      <Text style={[styles.prizeLabel, { color: ui.textMuted }]}> {label}</Text>
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
  const buyIn      = useGameStore((s) => s.buyIn);
  const numPlayers = useGameStore((s) => s.numPlayers);
  const playMode     = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const onlineIsHost = useGameStore((s) => s.onlineIsHost);
  const screen = useGameStore((s) => s.screen);
  const { isAuthenticated } = useConvexAuth();
  const startGame  = useGameStore((s) => s.startGame);
  const goHome     = useGameStore((s) => s.goHome);
  const { width }  = useWindowDimensions();
  const lay        = layoutFor(width);

  const rematch = useMutation(api.rooms.rematch);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const [returning, setReturning] = useState(false);
  const leftResultRef = useRef(false);

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
    leftResultRef.current = true;
    startGame(numPlayers);
  }, [
    playMode,
    onlineRoomId,
    onlineIsHost,
    returning,
    rematch,
    startGame,
    numPlayers,
  ]);

  useEffect(() => {
    if (playMode !== "solo" || screen !== "result") return;
    const timer = setTimeout(() => {
      if (leftResultRef.current) return;
      startGame(numPlayers);
    }, 5000);
    return () => clearTimeout(timer);
  }, [playMode, screen, startGame, numPlayers]);

  const handleMainMenu = useCallback(async () => {
    leftResultRef.current = true;
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

  return (
    <Background variant="game">
      {humanRank1 && !isDraw && !reduceMotion && <Confetti />}
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { maxWidth: lay.maxContent }]}>

          <Animated.View
            entering={reduceMotion ? FadeIn.duration(300) : ZoomIn.springify().damping(14)}
            style={styles.hero}
          >
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

          {creditPrize != null && (
            <Animated.View entering={FadeInDown.delay(500).duration(350)} style={styles.prizeWrap}>
              <CreditPrizeCounter amount={creditPrize} label={creditPrizeLabel} />
            </Animated.View>
          )}

          <Animated.View
            entering={FadeInDown.delay(600).duration(350)}
            style={styles.actions}
          >
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
          </Animated.View>

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

  hero:      { alignItems: "center", gap: spacing.xs },
  heroEmoji: { fontSize: 64, marginBottom: spacing.xs },
  heroTitle: { ...typography.display, textAlign: "center" },
  heroSub:   { ...typography.body, textAlign: "center" },

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

  prizeWrap: { alignItems: "center", gap: spacing.xs },
  prizeRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  prizeAmount: {
    ...typography.title,
  },
  prizeLabel: { ...typography.body },

  actions: { gap: spacing.sm },
});
