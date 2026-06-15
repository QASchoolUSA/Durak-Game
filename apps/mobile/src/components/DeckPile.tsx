import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  type Card as CardModel,
  type Suit,
  RANK_LABELS,
  SUIT_SYMBOLS,
  isRed,
} from "@durak/game-core";
import { useCardTheme } from "../theme/CardThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { MeasuredAnchor } from "./MeasuredAnchor";
import { Card } from "./Card";
import { radius } from "../theme";
import { useGameLayoutContext } from "../theme/GameLayoutContext";

export interface DeckPileProps {
  deckCount: number;
  trumpCard: CardModel;
  trumpSuit: Suit;
  skipEnterAnimation?: boolean;
  onDeckAnchorLayout?: (anchorId: string, rect: import("./MeasuredAnchor").AnchorRect) => void;
  onDeckAnchorRemoved?: (anchorId: string) => void;
}

const DECK_ANCHOR_ID = "deck";

/** Room for trump badge (top-left) and count ring (bottom-right). */
const FRAME_PAD = { top: 10, left: 10, bottom: 10, right: 10 };

function DeckPileComponent({
  deckCount,
  trumpCard,
  trumpSuit,
  onDeckAnchorLayout,
  onDeckAnchorRemoved,
}: DeckPileProps) {
  const theme = useCardTheme();
  const ui = useUiTheme();
  const { cardSizes } = useGameLayoutContext();
  const { w, h } = cardSizes.small;
  const suitColor = isRed(trumpSuit) ? theme.suitRed : theme.suitBlack;
  const rank = RANK_LABELS[trumpCard.rank];
  const symbol = SUIT_SYMBOLS[trumpSuit];

  const frame = useMemo(
    () => ({
      width: w + 6 + FRAME_PAD.left + FRAME_PAD.right,
      height: h + 6 + FRAME_PAD.top + FRAME_PAD.bottom,
    }),
    [w, h],
  );

  return (
    <View style={[styles.column, frame]}>
      <MeasuredAnchor
        anchorId={DECK_ANCHOR_ID}
        onAnchorLayout={onDeckAnchorLayout}
        onAnchorRemoved={onDeckAnchorRemoved}
        style={{ ...styles.anchorWrap, width: frame.width, height: frame.height }}
      >
        <View
          style={[
            styles.stack,
            {
              width: w + 6,
              height: h + 6,
              top: FRAME_PAD.top,
              left: FRAME_PAD.left,
            },
          ]}
        >
          {deckCount > 0 ? (
            <>
              <Card faceDown compact width={w} height={h} style={{ position: "absolute", top: 5, left: 5 }} />
              <Card faceDown compact width={w} height={h} style={{ position: "absolute", top: 2, left: 2 }} />
              <Card faceDown compact width={w} height={h} />
            </>
          ) : (
            <View
              style={[
                styles.emptyDeck,
                {
                  width: w,
                  height: h,
                  backgroundColor: ui.feltEdge,
                  borderColor: ui.panelBorderSoft,
                },
              ]}
            />
          )}

          <View
            style={[styles.centerSuitWrap, { width: w, height: h }]}
            pointerEvents="none"
          >
            <Text
              style={[
                styles.centerSuit,
                { color: suitColor, fontSize: Math.round(w * 0.45) },
              ]}
            >
              {symbol}
            </Text>
          </View>

          <View
            style={[
              styles.trumpBadge,
              {
                backgroundColor: theme.face,
                borderColor: ui.accent,
                shadowColor: ui.accent,
              },
            ]}
          >
            <Text style={[styles.trumpRank, { color: suitColor }]}>{rank}</Text>
            <Text style={[styles.trumpSuit, { color: suitColor }]}>{symbol}</Text>
          </View>

          <View
            style={[
              styles.countRing,
              {
                backgroundColor: ui.badgeBg,
                shadowColor: ui.accent,
              },
            ]}
          >
            <Text style={[styles.countText, { color: ui.badgeText }]}>{deckCount}</Text>
          </View>
        </View>
      </MeasuredAnchor>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: "center",
    justifyContent: "center",
  },
  anchorWrap: {
    position: "relative",
  },
  stack: {
    position: "absolute",
  },
  emptyDeck: {
    borderRadius: radius.card,
    borderWidth: 1,
  },
  centerSuitWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  centerSuit: {
    fontWeight: "800",
    lineHeight: undefined,
  },
  trumpBadge: {
    position: "absolute",
    top: -5,
    left: -5,
    borderRadius: 7,
    borderWidth: 1.5,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: "center",
    shadowOpacity: 0.70,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  trumpRank: { fontSize: 11, fontWeight: "900", lineHeight: 12 },
  trumpSuit: { fontSize: 10, fontWeight: "800", lineHeight: 11 },
  countRing: {
    position: "absolute",
    bottom: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.70,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  countText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 12,
  },
});

export const DeckPile = React.memo(DeckPileComponent);
export { DECK_ANCHOR_ID };
