import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, typography } from "../theme";

const SECTIONS = [
  {
    title: "The Goal",
    body: "Be the first player to play all cards from your hand. The last player left holding cards is the Durak (fool).",
  },
  {
    title: "Card Ranking",
    body: "Cards rank from lowest to highest: 6 · 7 · 8 · 9 · 10 · J · Q · K · A\n\nThe trump suit beats any non-trump card, regardless of rank. Within the same suit, higher rank wins.",
  },
  {
    title: "Attacking",
    body: "The attacker places one or more cards of the same rank on the table. After the first card, other non-defender players may also throw in cards matching any rank already on the table.",
  },
  {
    title: "Defending",
    body: "The defender must cover each attack card with a higher card of the same suit, or any trump card. If the defender cannot or chooses not to defend, they take all table cards into their hand.",
  },
  {
    title: "Taking Cards",
    body: "If the defender takes cards, they pick up everything on the table and do NOT discard. Other attackers may continue throwing in before the defender takes.",
  },
  {
    title: "Perevodnoy — Transfer",
    body: "In Perevodnoy mode, the defender has a third option: play a card of the same rank as the initial attack. This transfers the entire attack to the next player, who now must defend.\n\nTransfer is only possible on the opening attack (one card on the table) and before any throw-ins.",
  },
  {
    title: "End of Round",
    body: "When all attacks are defended (or taken), the round ends. Players draw back up to 6 cards from the deck starting with the attacker. Once the deck is empty, no draws occur.",
  },
  {
    title: "Winning",
    body: "A player leaves the game as soon as their hand is empty and the deck is empty. The last player with cards is the Durak and loses the round.",
  },
];

export interface RulesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RulesModal({ visible, onClose }: RulesModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={[colors.feltMid, colors.feltBottom]}
        style={styles.fill}
      >
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>HOW TO PLAY</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.intro}>
              Durak (Дурак) is one of Russia's most beloved card games. Simple to
              learn, rich in strategy — the last player with cards is the fool.
            </Text>

            {SECTIONS.map((s) => (
              <View key={s.title} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.dot} />
                  <Text style={styles.sectionTitle}>{s.title}</Text>
                </View>
                <Text style={styles.sectionBody}>{s.body}</Text>
              </View>
            ))}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                🃏 Good luck — and don't be the Durak!
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.gold,
    letterSpacing: 3,
    flex: 1,
    textAlign: "center",
  },
  closeBtn:  { position: "absolute", right: spacing.lg },
  closeIcon: { color: colors.textMuted, fontSize: 20, fontWeight: "700" },
  scroll:    { flex: 1 },
  content:   { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
    fontStyle: "italic",
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.gold,
  },
  sectionBody: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    paddingLeft: spacing.md,
  },
  footer: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  footerText: {
    ...typography.body,
    color: colors.textFaint,
  },
});
