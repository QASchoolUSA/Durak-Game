import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Background } from "../components/Background";
import { useGameStore } from "../game/store";
import { colors, radius, spacing } from "../theme";

export function ResultScreen() {
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const names = useGameStore((s) => s.names);
  const pot = useGameStore((s) => s.pot);
  const numPlayers = useGameStore((s) => s.numPlayers);
  const startGame = useGameStore((s) => s.startGame);
  const goHome = useGameStore((s) => s.goHome);

  const loser = game?.loserId ?? null;
  const humanLost = loser === humanId;
  const isDraw = loser === null;

  const title = isDraw ? "Draw!" : humanLost ? "You are the Durak!" : "You Win!";
  const subtitle = isDraw
    ? "Everyone ran out together."
    : humanLost
      ? "Better luck next round."
      : `${names[loser] ?? loser} is the fool. You take the pot of ${pot}.`;

  return (
    <Background>
      <SafeAreaView style={styles.safe}>
        <Animated.View entering={ZoomIn.duration(450)} style={styles.card}>
          <Text style={[styles.emoji]}>{isDraw ? "\u{1F91D}" : humanLost ? "\u{1F921}" : "\u{1F3C6}"}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {!humanLost && !isDraw && (
            <View style={styles.potRow}>
              <View style={styles.coin}>
                <Text style={styles.coinText}>$</Text>
              </View>
              <Text style={styles.potText}>+{pot} credits</Text>
            </View>
          )}

          <Pressable style={styles.primary} onPress={() => startGame(numPlayers)}>
            <Text style={styles.primaryText}>Rematch</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={goHome}>
            <Text style={styles.secondaryText}>Home</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.panel,
    borderRadius: radius.panel,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  emoji: { fontSize: 64, marginBottom: spacing.sm },
  title: { color: colors.gold, fontSize: 30, fontWeight: "900", textAlign: "center" },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  potRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.lg },
  coin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  coinText: { color: colors.feltBottom, fontWeight: "900" },
  potText: { color: colors.success, fontWeight: "800", fontSize: 18 },
  primary: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: radius.pill,
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  primaryText: { color: colors.feltBottom, fontWeight: "900", fontSize: 17, letterSpacing: 1 },
  secondary: {
    paddingVertical: 12,
    borderRadius: radius.pill,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  secondaryText: { color: colors.textLight, fontWeight: "700" },
});
