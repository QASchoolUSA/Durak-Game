import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { Card as CardModel } from "@durak/game-core";
import { Card } from "./Card";
import { cardSize } from "../theme";

// Decorative cards for the fan — fixed suit/rank combos for visual appeal
const FAN_CARDS: CardModel[] = [
  { suit: "spades",   rank: 14, id: "fan-0" },
  { suit: "hearts",   rank: 12, id: "fan-1" },
  { suit: "diamonds", rank: 11, id: "fan-2" },
  { suit: "clubs",    rank: 13, id: "fan-3" },
  { suit: "spades",   rank:  6, id: "fan-4" },
];

// Static per-card layout (rotation + horizontal offset)
const CARD_LAYOUT = [
  { rotate: -24, tx: -88, ty:  18 },
  { rotate: -12, tx: -44, ty:   6 },
  { rotate:   0, tx:   0, ty:   0 },
  { rotate:  12, tx:  44, ty:   6 },
  { rotate:  24, tx:  88, ty:  18 },
];

const { w, h } = cardSize.fan;

function FanCard({
  card,
  rotate,
  tx,
  ty,
  sway,
  isTrump,
}: {
  card: CardModel;
  rotate: number;
  tx: number;
  ty: number;
  sway: SharedValue<number>;
  isTrump: boolean;
}) {
  const aStyle = useAnimatedStyle(() => {
    const totalRot = rotate + sway.value * (rotate === 0 ? 0.4 : Math.sign(rotate) * 0.8);
    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${totalRot}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.card, aStyle]}>
      <Card card={card} width={w} height={h} trump={isTrump} />
    </Animated.View>
  );
}

export function CardFan() {
  const sway = useSharedValue(0);

  useEffect(() => {
    sway.value = withRepeat(
      withSequence(
        withTiming( 1, { duration: 3200 }),
        withTiming(-1, { duration: 3200 }),
      ),
      -1,
      true,
    );
  }, [sway]);

  return (
    <View style={styles.container} pointerEvents="none">
      {FAN_CARDS.map((card, i) => (
        <FanCard
          key={card.id}
          card={card}
          rotate={CARD_LAYOUT[i]!.rotate}
          tx={CARD_LAYOUT[i]!.tx}
          ty={CARD_LAYOUT[i]!.ty}
          sway={sway}
          // The front card (diamonds jack) is the "trump" card for visual flair
          isTrump={i === 2}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: w,
    height: h,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
  },
});
