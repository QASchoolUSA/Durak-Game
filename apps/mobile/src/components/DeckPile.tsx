import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import {
  type Card as CardModel,
  type Suit,
  RANK_LABELS,
  SUIT_SYMBOLS,
  isRed,
} from "@durak/game-core";
import { Card } from "./Card";
import { colors, cardSize, radius, spacing } from "../theme";

export interface DeckPileProps {
  deckCount: number;
  trumpCard: CardModel;
  trumpSuit: Suit;
}

function TrumpBadge({ trumpCard, trumpSuit }: { trumpCard: CardModel; trumpSuit: Suit }) {
  const suitColor = isRed(trumpSuit) ? colors.suitRed : colors.suitBlack;
  const rank = RANK_LABELS[trumpCard.rank];

  return (
    <View style={styles.trumpBadge}>
      <Text style={styles.trumpLabel}>TRUMP</Text>
      <View style={styles.trumpRow}>
        <Text style={[styles.trumpRank, { color: suitColor }]}>{rank}</Text>
        <Text style={[styles.trumpSuit, { color: suitColor }]}>{SUIT_SYMBOLS[trumpSuit]}</Text>
      </View>
    </View>
  );
}

function DeckPileComponent({ deckCount, trumpCard, trumpSuit }: DeckPileProps) {
  const { w, h } = cardSize.small;
  const stackDepth = 6;

  if (deckCount === 0) {
    return (
      <Animated.View entering={FadeIn} style={styles.column}>
        <TrumpBadge trumpCard={trumpCard} trumpSuit={trumpSuit} />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.column}>
      <Animated.View entering={ZoomIn.duration(450)}>
        <TrumpBadge trumpCard={trumpCard} trumpSuit={trumpSuit} />
      </Animated.View>

      <View style={[styles.stack, { width: w + stackDepth, height: h + stackDepth }]}>
        <Card faceDown width={w} height={h} style={{ position: "absolute", top: stackDepth, left: stackDepth }} />
        <Card faceDown width={w} height={h} style={{ position: "absolute", top: stackDepth / 2, left: stackDepth / 2 }} />
        <Card faceDown width={w} height={h} style={{ position: "absolute", top: 0, left: 0 }} />
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{deckCount}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: "center",
    gap: spacing.sm,
  },
  trumpBadge: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.panel,
    backgroundColor: colors.cardFace,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: "center",
    shadowColor: colors.trumpGlow,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  trumpLabel: {
    color: colors.textDark,
    opacity: 0.45,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  trumpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trumpRank: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
  },
  trumpSuit: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  stack: {
    position: "relative",
  },
  countBadge: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: colors.feltEdge,
    borderRadius: radius.pill,
    minWidth: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  countText: { color: colors.textLight, fontWeight: "800", fontSize: 13 },
});

export const DeckPile = React.memo(DeckPileComponent);
