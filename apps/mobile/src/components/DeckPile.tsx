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
import { colors, cardSize, radius } from "../theme";

export interface DeckPileProps {
  deckCount: number;
  trumpCard: CardModel;
  trumpSuit: Suit;
}

function DeckPileComponent({ deckCount, trumpCard, trumpSuit }: DeckPileProps) {
  const { w, h } = cardSize.small;
  const suitColor = isRed(trumpSuit) ? colors.suitRed : colors.suitBlack;
  const rank = RANK_LABELS[trumpCard.rank];

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.column}>
      <View style={[styles.tagStack, { width: w + 6, height: h + 6 }]}>
        {deckCount > 0 ? (
          <>
            <Card faceDown width={w} height={h} style={{ position: "absolute", top: 5, left: 5 }} />
            <Card faceDown width={w} height={h} style={{ position: "absolute", top: 2, left: 2 }} />
            <Card faceDown width={w} height={h} />
          </>
        ) : (
          <View style={[styles.tagEmptyDeck, { width: w, height: h }]}>
            <Text style={styles.tagEmptyText}>0</Text>
          </View>
        )}
        <View style={styles.cornerTag}>
          <Text style={[styles.cornerRank, { color: suitColor }]}>{rank}</Text>
          <Text style={[styles.cornerSuit, { color: suitColor }]}>{SUIT_SYMBOLS[trumpSuit]}</Text>
        </View>
        {deckCount > 0 && (
          <View style={styles.tagCountRing}>
            <Text style={styles.tagCountText}>{deckCount}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: "center",
  },
  tagStack: {
    position: "relative",
  },
  tagEmptyDeck: {
    borderRadius: radius.card,
    backgroundColor: colors.feltEdge,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: "center",
    justifyContent: "center",
  },
  tagEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  cornerTag: {
    position: "absolute",
    top: -4,
    left: -4,
    backgroundColor: colors.cardFace,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: "center",
    shadowColor: colors.trumpGlow,
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  cornerRank: { fontSize: 11, fontWeight: "900", lineHeight: 12 },
  cornerSuit: { fontSize: 10, fontWeight: "800", lineHeight: 11 },
  tagCountRing: {
    position: "absolute",
    bottom: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  tagCountText: {
    color: colors.feltBottom,
    fontWeight: "900",
    fontSize: 11,
  },
});

export const DeckPile = React.memo(DeckPileComponent);
