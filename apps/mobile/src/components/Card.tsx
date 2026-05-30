import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import {
  type Card as CardModel,
  RANK_LABELS,
  SUIT_SYMBOLS,
  isRed,
} from "@durak/game-core";
import { colors, radius } from "../theme";

export interface CardProps {
  card?: CardModel;
  faceDown?: boolean;
  width?: number;
  height?: number;
  /** Highlight as a trump card. */
  trump?: boolean;
  /** Render greyed-out (e.g. not currently playable). */
  dimmed?: boolean;
  /** Highlight with a gold ring (e.g. selectable / active). */
  highlighted?: boolean;
  style?: ViewStyle;
}

function CardFace({
  card,
  width,
  height,
  trump,
}: {
  card: CardModel;
  width: number;
  height: number;
  trump?: boolean;
}) {
  const color = isRed(card.suit) ? colors.suitRed : colors.suitBlack;
  const label = RANK_LABELS[card.rank];
  const symbol = SUIT_SYMBOLS[card.suit];
  const cornerFont = Math.round(width * 0.26);
  const cornerSuit = Math.round(width * 0.22);
  const centerFont = Math.round(width * 0.6);

  return (
    <View
      style={[
        styles.base,
        {
          width,
          height,
          backgroundColor: colors.cardFace,
          borderColor: trump ? colors.gold : colors.cardFaceEdge,
          borderWidth: trump ? 2 : 1,
        },
      ]}
    >
      <View style={styles.cornerTL}>
        <Text style={[styles.rank, { fontSize: cornerFont, color }]}>{label}</Text>
        <Text style={[styles.cornerSuit, { fontSize: cornerSuit, color }]}>{symbol}</Text>
      </View>

      <Text style={[styles.center, { fontSize: centerFont, color }]}>{symbol}</Text>

      <View style={styles.cornerBR}>
        <Text style={[styles.rank, { fontSize: cornerFont, color }]}>{label}</Text>
        <Text style={[styles.cornerSuit, { fontSize: cornerSuit, color }]}>{symbol}</Text>
      </View>
    </View>
  );
}

function CardBack({ width, height }: { width: number; height: number }) {
  return (
    <View style={[styles.base, { width, height, backgroundColor: colors.cardBack }]}>
      <View style={styles.backInner}>
        <View style={styles.backDiamond} />
      </View>
    </View>
  );
}

function CardComponent({
  card,
  faceDown,
  width = 66,
  height = 92,
  trump,
  dimmed,
  highlighted,
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.shadow,
        { width, height, borderRadius: radius.card },
        highlighted && styles.highlight,
        dimmed && styles.dimmed,
        style,
      ]}
    >
      {faceDown || !card ? (
        <CardBack width={width} height={height} />
      ) : (
        <CardFace card={card} width={width} height={height} trump={trump} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  base: {
    borderRadius: radius.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rank: {
    fontWeight: "800",
  },
  cornerSuit: {
    marginTop: -2,
    fontWeight: "700",
  },
  cornerTL: {
    position: "absolute",
    top: 4,
    left: 5,
    alignItems: "center",
  },
  cornerBR: {
    position: "absolute",
    bottom: 4,
    right: 5,
    alignItems: "center",
    transform: [{ rotate: "180deg" }],
  },
  center: {
    fontWeight: "700",
    opacity: 0.9,
  },
  backInner: {
    flex: 1,
    margin: 4,
    borderRadius: radius.card - 3,
    borderWidth: 2,
    borderColor: colors.cardBackAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  backDiamond: {
    width: "44%",
    height: "44%",
    backgroundColor: colors.cardBackAccent,
    transform: [{ rotate: "45deg" }],
    borderRadius: 4,
    opacity: 0.7,
  },
  highlight: {
    shadowColor: colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    borderRadius: radius.card,
  },
  dimmed: {
    opacity: 0.45,
  },
});

export const Card = React.memo(CardComponent);
