import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
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
const FAN_SPREAD_X = 88;
const FAN_DROP_Y = 18;

/** Wide enough for ±88px fan spread from center. */
const FAN_WIDTH = w + FAN_SPREAD_X * 2;
const FAN_HEIGHT = h + FAN_DROP_Y * 2 + 8;

function FanCard({
  card,
  rotate,
  tx,
  ty,
  sway,
  spread,
  isTrump,
}: {
  card: CardModel;
  rotate: number;
  tx: number;
  ty: number;
  sway: SharedValue<number>;
  spread: SharedValue<number>;
  isTrump: boolean;
}) {
  const transformStyle = useAnimatedStyle(() => {
    const spreadT = spread.value;
    const totalRot = (rotate * spreadT) + sway.value * (rotate === 0 ? 0.4 : Math.sign(rotate) * 0.8);
    return {
      opacity: 0.35 + spreadT * 0.65,
      transform: [
        { translateX: tx * spreadT },
        { translateY: ty * spreadT },
        { rotate: `${totalRot}deg` },
        { scale: 0.88 + spreadT * 0.12 },
      ],
    };
  });

  return (
    <View style={styles.cardAnchor}>
      <Animated.View style={[{ width: w, height: h }, transformStyle]}>
        <Card card={card} width={w} height={h} trump={isTrump} />
      </Animated.View>
    </View>
  );
}

export function CardFan() {
  const sway = useSharedValue(0);
  const spread = useSharedValue(0);
  const floatY = useSharedValue(0);

  useEffect(() => {
    spread.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

    sway.value = withRepeat(
      withSequence(
        withTiming( 1, { duration: 3200 }),
        withTiming(-1, { duration: 3200 }),
      ),
      -1,
      true,
    );

    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming( 6, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [sway, spread, floatY]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      {FAN_CARDS.map((card, i) => (
        <FanCard
          key={card.id}
          card={card}
          rotate={CARD_LAYOUT[i]!.rotate}
          tx={CARD_LAYOUT[i]!.tx}
          ty={CARD_LAYOUT[i]!.ty}
          sway={sway}
          spread={spread}
          isTrump={i === 2}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: FAN_WIDTH,
    height: FAN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cardAnchor: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: w,
    height: h,
    marginLeft: -w / 2,
    marginTop: -h / 2,
  },
});
