import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { Card as CardModel } from "@durak/game-core";
import { Card } from "./Card";
import { useGameLayout } from "../theme/useGameLayout";
import { useCardTheme } from "../theme/CardThemeContext";

const FAN_CARDS: CardModel[] = [
  { suit: "spades",   rank: 14, id: "fan-0" },
  { suit: "hearts",   rank: 12, id: "fan-1" },
  { suit: "diamonds", rank: 11, id: "fan-2" },
  { suit: "clubs",    rank: 13, id: "fan-3" },
  { suit: "spades",   rank:  6, id: "fan-4" },
];

const BASE_CARD_LAYOUT = [
  { rotate: -24, tx: -88, ty:  18 },
  { rotate: -12, tx: -44, ty:   6 },
  { rotate:   0, tx:   0, ty:   0 },
  { rotate:  12, tx:  44, ty:   6 },
  { rotate:  24, tx:  88, ty:  18 },
];

export interface CardFanProps {
  /** When false, fan renders at full spread with no motion loops. */
  animate?: boolean;
}

function FanCard({
  card,
  rotate,
  tx,
  ty,
  sway,
  spread,
  isTrump,
  cardW,
  cardH,
}: {
  card: CardModel;
  rotate: number;
  tx: number;
  ty: number;
  sway: SharedValue<number>;
  spread: SharedValue<number>;
  isTrump: boolean;
  cardW: number;
  cardH: number;
}) {
  const cardTheme = useCardTheme();
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
    <View
      style={[
        styles.cardAnchor,
        {
          width: cardW,
          height: cardH,
          marginLeft: -cardW / 2,
          marginTop: -cardH / 2,
        },
      ]}
    >
      <Animated.View style={[{ width: cardW, height: cardH }, transformStyle]}>
        <Card
          card={card}
          width={cardW}
          height={cardH}
          trump={isTrump}
          themeOverride={cardTheme}
        />
      </Animated.View>
    </View>
  );
}

export function CardFan({ animate = true }: CardFanProps) {
  const { cardSizes, s } = useGameLayout();
  const { w, h } = cardSizes.fan;
  const fanSpreadX = s(88);
  const fanDropY = s(18);
  const fanWidth = w + fanSpreadX * 2;
  const fanHeight = h + fanDropY * 2 + s(8);

  const cardLayout = useMemo(
    () =>
      BASE_CARD_LAYOUT.map((item) => ({
        rotate: item.rotate,
        tx: s(Math.abs(item.tx)) * Math.sign(item.tx),
        ty: s(item.ty),
      })),
    [s],
  );

  const sway = useSharedValue(0);
  const spread = useSharedValue(animate ? 0 : 1);
  const floatY = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(sway);
    cancelAnimation(spread);
    cancelAnimation(floatY);

    if (!animate) {
      spread.value = 1;
      sway.value = 0;
      floatY.value = 0;
      return;
    }

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

    return () => {
      cancelAnimation(sway);
      cancelAnimation(spread);
      cancelAnimation(floatY);
    };
  }, [animate, sway, spread, floatY]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { width: fanWidth, height: fanHeight },
        containerStyle,
      ]}
      pointerEvents="none"
    >
      {FAN_CARDS.map((card, i) => (
        <FanCard
          key={card.id}
          card={card}
          rotate={cardLayout[i]!.rotate}
          tx={cardLayout[i]!.tx}
          ty={cardLayout[i]!.ty}
          sway={sway}
          spread={spread}
          isTrump={i === 2}
          cardW={w}
          cardH={h}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardAnchor: {
    position: "absolute",
    left: "50%",
    top: "50%",
  },
});
