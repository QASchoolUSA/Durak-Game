import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  type Card as CardModel,
  type Suit,
  RANK_LABELS,
  SUIT_SYMBOLS,
  isRed,
} from "@durak/game-core";
import { Card } from "./Card";
import { colors, cardSize, radius, shadows } from "../theme";

export interface DeckPileProps {
  deckCount: number;
  trumpCard: CardModel;
  trumpSuit: Suit;
}

function DeckPileComponent({ deckCount, trumpCard, trumpSuit }: DeckPileProps) {
  const { w, h } = cardSize.small;
  const suitColor = isRed(trumpSuit) ? colors.suitRed : "#20232A";
  const rank = RANK_LABELS[trumpCard.rank];
  const symbol = SUIT_SYMBOLS[trumpSuit];

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.column}>

      {/* ── Deck stack ── */}
      <View style={[styles.stack, { width: w + 6, height: h + 6 }]}>
        {deckCount > 0 ? (
          <>
            <Card faceDown width={w} height={h} style={{ position: "absolute", top: 5, left: 5 }} />
            <Card faceDown width={w} height={h} style={{ position: "absolute", top: 2, left: 2 }} />
            <Card faceDown width={w} height={h} />
          </>
        ) : (
          <View style={[styles.emptyDeck, { width: w, height: h }]}>
            <Text style={styles.emptyText}>–</Text>
          </View>
        )}

        {/* Trump badge — top-left corner of stack */}
        <View style={styles.trumpBadge}>
          <Text style={[styles.trumpRank, { color: suitColor }]}>{rank}</Text>
          <Text style={[styles.trumpSuit, { color: suitColor }]}>{symbol}</Text>
        </View>

        {/* Deck count ring — bottom-right */}
        {deckCount > 0 && (
          <View style={styles.countRing}>
            <Text style={styles.countText}>{deckCount}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: "center",
    gap: 6,
  },
  stack: {
    position: "relative",
  },
  emptyDeck: {
    borderRadius: radius.card,
    backgroundColor: colors.feltEdge,
    borderWidth: 1,
    borderColor: "rgba(231,192,103,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.textFaint,
    fontSize: 18,
    fontWeight: "300",
  },

  // Trump corner badge
  trumpBadge: {
    position: "absolute",
    top: -5,
    left: -5,
    backgroundColor: colors.cardFace,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: "center",
    ...shadows.goldGlow,
  },
  trumpRank: { fontSize: 11, fontWeight: "900", lineHeight: 12 },
  trumpSuit: { fontSize: 10, fontWeight: "800", lineHeight: 11 },

  // Deck count ring
  countRing: {
    position: "absolute",
    bottom: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.goldGlow,
  },
  countText: {
    color: colors.feltBottom,
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 12,
  },
});

export const DeckPile = React.memo(DeckPileComponent);
