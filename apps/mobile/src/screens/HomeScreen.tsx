import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { GameVariant, ThrowInScope } from "@durak/game-core";
import { Background } from "../components/Background";
import { useGameStore } from "../game/store";
import { colors, radius, spacing } from "../theme";

const VARIANTS: { id: GameVariant; label: string; hint: string }[] = [
  { id: "podkidnoy", label: "Podkidnoy", hint: "Defend or take the attack" },
  { id: "perevodnoy", label: "Perevodnoy", hint: "Defend, take, or transfer same rank" },
];

const THROW_IN: { id: ThrowInScope; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "Any attacker may throw in" },
  { id: "neighbor", label: "Neighbors", hint: "Only seats next to the defender" },
];

function rulesFooter(variant: GameVariant, throwInScope: ThrowInScope, numPlayers: number): string {
  const mode = variant === "podkidnoy" ? "Podkidnoy" : "Perevodnoy";
  const throwIn =
    numPlayers <= 2
      ? "all throw-in"
      : throwInScope === "all"
        ? "all throw-in"
        : "neighbor throw-in";
  return `Single-player · ${mode} · ${throwIn}`;
}

export function HomeScreen() {
  const numPlayers = useGameStore((s) => s.numPlayers);
  const variant = useGameStore((s) => s.variant);
  const throwInScope = useGameStore((s) => s.throwInScope);
  const setNumPlayers = useGameStore((s) => s.setNumPlayers);
  const setVariant = useGameStore((s) => s.setVariant);
  const setThrowInScope = useGameStore((s) => s.setThrowInScope);
  const startGame = useGameStore((s) => s.startGame);
  const startBeatTransferDebug = useGameStore((s) => s.startBeatTransferDebug);
  const buyIn = useGameStore((s) => s.buyIn);

  const activeThrowIn = THROW_IN.find((t) => t.id === throwInScope)!;
  const activeVariant = VARIANTS.find((v) => v.id === variant)!;

  return (
    <Background>
      <SafeAreaView style={styles.safe}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <Text style={styles.title}>DURAK</Text>
          <Text style={styles.subtitle}>The classic Russian card game</Text>
        </Animated.View>

        <View style={styles.balanceRow}>
          <View style={styles.coin}>
            <Text style={styles.coinText}>$</Text>
          </View>
          <Text style={styles.balance}>1,000 credits</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.panel}>
          <Text style={styles.panelLabel}>Players</Text>
          <View style={styles.segment}>
            {[2, 3, 4].map((n) => (
              <Pressable
                key={n}
                onPress={() => setNumPlayers(n)}
                style={[styles.segmentBtn, numPlayers === n && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, numPlayers === n && styles.segmentTextActive]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.panelLabel, styles.sectionGap]}>Mode</Text>
          <View style={styles.segmentWide}>
            {VARIANTS.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setVariant(v.id)}
                style={[styles.segmentBtnWide, variant === v.id && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentTextSm, variant === v.id && styles.segmentTextActive]}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>{activeVariant.hint}</Text>

          <Text style={[styles.panelLabel, styles.sectionGap, numPlayers <= 2 && styles.dimmed]}>
            Throw-in
          </Text>
          <View style={[styles.segmentWide, numPlayers <= 2 && styles.dimmed]}>
            {THROW_IN.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setThrowInScope(t.id)}
                disabled={numPlayers <= 2}
                style={[styles.segmentBtnWide, throwInScope === t.id && styles.segmentBtnActive]}
              >
                <Text
                  style={[styles.segmentTextSm, throwInScope === t.id && styles.segmentTextActive]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.hint, numPlayers <= 2 && styles.dimmed]}>
            {numPlayers <= 2 ? "Only matters for 3–4 players" : activeThrowIn.hint}
          </Text>

          <Text style={styles.stake}>Buy-in: {buyIn} credits · winner takes the pot</Text>

          <Pressable style={styles.play} onPress={() => startGame()}>
            <Text style={styles.playText}>Play vs AI</Text>
          </Pressable>

          {__DEV__ && (
            <Pressable style={styles.debugPlay} onPress={() => startBeatTransferDebug()}>
              <Text style={styles.debugPlayText}>Test beat / transfer</Text>
              <Text style={styles.debugPlayHint}>
                Jump to defend with beat or transfer choice (3 players, no AI)
              </Text>
            </Pressable>
          )}
        </Animated.View>

        <Text style={styles.footer}>{rulesFooter(variant, throwInScope, numPlayers)}</Text>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.lg },
  title: { color: colors.gold, fontSize: 56, fontWeight: "900", letterSpacing: 6 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.xl },
  coin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  coinText: { color: colors.feltBottom, fontWeight: "900" },
  balance: { color: colors.textLight, fontWeight: "700", fontSize: 16 },
  panel: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.panel,
    borderRadius: radius.panel,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: "center",
  },
  panelLabel: { color: colors.textMuted, fontWeight: "700", marginBottom: spacing.sm },
  sectionGap: { marginTop: spacing.md, alignSelf: "stretch" },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.feltEdge,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  segmentWide: {
    flexDirection: "row",
    backgroundColor: colors.feltEdge,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    width: "100%",
  },
  segmentBtn: { width: 64, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center" },
  segmentBtnWide: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center" },
  segmentBtnActive: { backgroundColor: colors.gold },
  segmentText: { color: colors.textLight, fontWeight: "800", fontSize: 18 },
  segmentTextSm: { color: colors.textLight, fontWeight: "800", fontSize: 14 },
  segmentTextActive: { color: colors.feltBottom },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs, textAlign: "center" },
  dimmed: { opacity: 0.45 },
  stake: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, textAlign: "center" },
  play: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    width: "100%",
    alignItems: "center",
  },
  playText: { color: colors.feltBottom, fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  debugPlay: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: "rgba(70, 167, 88, 0.12)",
  },
  debugPlayText: { color: colors.success, fontWeight: "800", fontSize: 14 },
  debugPlayHint: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  footer: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xl, textAlign: "center" },
});
