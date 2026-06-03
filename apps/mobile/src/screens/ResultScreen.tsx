import React, { useEffect, useRef } from "react";
import { Animated as RNAnimated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { Background } from "../components/Background";
import { Confetti } from "../components/Confetti";
import { MenuButton } from "../components/MenuButton";
import { useGameStore } from "../game/store";
import { layoutFor, colors, radius, shadows, spacing, typography } from "../theme";

// ── Rank badges ──────────────────────────────────────────────────────────────

const RANK_MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];

function rankBadge(rank: number, total: number, isLoser: boolean) {
  if (isLoser) return { emoji: "🃏", label: "DURAK", color: colors.lose };
  if (rank === 1) return { emoji: RANK_MEDALS[0]!, label: "WINNER", color: colors.gold };
  return { emoji: RANK_MEDALS[rank - 1] ?? `${rank}`, label: "FINISHED", color: colors.textMuted };
}

// ── Animated prize counter ───────────────────────────────────────────────────

function PrizeCounter({ amount }: { amount: number }) {
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
      <Text style={styles.prizeLabel}> credits</Text>
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
  const badge = rankBadge(rank, total, isLoser);

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(320)}
      style={[styles.rankRow, isHuman && styles.rankRowHuman]}
    >
      <Text style={styles.rankMedal}>{badge.emoji}</Text>
      <View style={styles.rankInfo}>
        <Text style={[styles.rankName, isHuman && styles.rankNameHuman]}>{name}</Text>
        {isHuman && <Text style={styles.rankYou}>(you)</Text>}
      </View>
      <View style={[styles.rankBadge, { borderColor: badge.color }]}>
        <Text style={[styles.rankBadgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export function ResultScreen() {
  const game       = useGameStore((s) => s.game);
  const humanId    = useGameStore((s) => s.humanId);
  const names      = useGameStore((s) => s.names);
  const pot        = useGameStore((s) => s.pot);
  const numPlayers = useGameStore((s) => s.numPlayers);
  const startGame  = useGameStore((s) => s.startGame);
  const goHome     = useGameStore((s) => s.goHome);
  const { width }  = useWindowDimensions();
  const lay        = layoutFor(width);

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
      : { headline: "VICTORY!", emoji: "🏆", headlineColor: colors.gold };

  const humanWon = !humanLost && !isDraw;

  return (
    <Background variant="game">
      {humanWon && <Confetti />}
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { maxWidth: lay.maxContent }]}>

          {/* ── Hero section ── */}
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.hero}>
            <Text style={styles.heroEmoji}>{emoji}</Text>
            <Text style={[styles.heroTitle, { color: headlineColor }]}>{headline}</Text>
            {humanWon && (
              <Text style={styles.heroSub}>
                {names[loser!] ?? loser} is the fool!
              </Text>
            )}
            {humanLost && (
              <Text style={styles.heroSub}>Better luck next round.</Text>
            )}
            {isDraw && (
              <Text style={styles.heroSub}>Everyone ran out together.</Text>
            )}
          </Animated.View>

          {/* ── Rankings ── */}
          <Animated.View entering={FadeInDown.delay(250).duration(350)} style={styles.rankingCard}>
            <Text style={styles.rankingHeader}>FINAL STANDINGS</Text>
            {rankings.map((r, idx) => (
              <RankingRow
                key={r.id}
                name={names[r.id] ?? r.id}
                rank={r.rank}
                total={rankings.length}
                isHuman={r.id === humanId}
                isLoser={r.isLoser}
                delay={300 + idx * 80}
              />
            ))}
          </Animated.View>

          {/* ── Prize counter ── */}
          {humanWon && (
            <Animated.View entering={FadeInDown.delay(500).duration(350)} style={styles.prizeWrap}>
              <PrizeCounter amount={pot} />
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
              onPress={() => startGame(numPlayers)}
              icon="▶"
            />
            <MenuButton
              label="MAIN MENU"
              variant="ghost"
              onPress={goHome}
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
  heroSub:   { ...typography.body, color: colors.textMuted, textAlign: "center" },

  // Rankings
  rankingCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: "rgba(231, 192, 103, 0.20)",
    overflow: "hidden",
    ...shadows.panel,
  },
  rankingHeader: {
    ...typography.label,
    color: colors.textFaint,
    textAlign: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(231, 192, 103, 0.12)",
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(231, 192, 103, 0.08)",
  },
  rankRowHuman: {
    backgroundColor: "rgba(231, 192, 103, 0.08)",
  },
  rankMedal: { fontSize: 22, width: 28 },
  rankInfo:  { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  rankName:  { ...typography.body, color: colors.textLight, fontWeight: "700" },
  rankNameHuman: { color: colors.gold },
  rankYou:   { ...typography.caption, color: colors.goldDim },
  rankBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankBadgeText: { ...typography.label, letterSpacing: 0.8 },

  // Prize
  prizeWrap: { alignItems: "center" },
  prizeRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  prizeCoin: { fontSize: 22 },
  prizeAmount: {
    ...typography.title,
    color: colors.success,
  },
  prizeLabel: { ...typography.body, color: colors.textMuted },

  // Actions
  actions: { gap: spacing.sm },
});
