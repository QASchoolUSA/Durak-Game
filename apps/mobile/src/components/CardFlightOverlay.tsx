import React, { useEffect, useRef, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useCardTheme } from "../theme/CardThemeContext";
import { useGameLayoutContext } from "../theme/GameLayoutContext";
import { Card } from "./Card";
import type { CardFlightStep } from "../game/cardFlight";
import { cardFlightDurationMs } from "../game/cardFlight";

export type { CardFlightStep };

export interface CardFlightOverlayProps {
  queue: CardFlightStep[];
  onStepComplete: (step: CardFlightStep) => void;
  onComplete: () => void;
  onFlightSound?: () => void;
  /** Throttle per-card sounds in solo; online plays once per run. */
  soundMode?: "solo" | "online" | "none";
  staggerMs?: number;
}

const SOUND_THROTTLE_MS = 200;
const WATCHDOG_BUFFER_MS = 2000;

interface FlyingCardItemProps {
  step: CardFlightStep;
  index: number;
  staggerMs: number;
  cardW: number;
  cardH: number;
  maybePlaySound: () => void;
  onStepComplete: (step: CardFlightStep) => void;
  onFinished: (id: string) => void;
}

function FlyingCardItem({
  step,
  index,
  staggerMs,
  cardW,
  cardH,
  maybePlaySound,
  onStepComplete,
  onFinished,
}: FlyingCardItemProps) {
  const x = useSharedValue(step.fromX - cardW / 2);
  const y = useSharedValue(step.fromY - cardH / 2);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  
  // Assign a random start tilt for an organic, physical feel
  const startRot = useRef(Math.random() * 24 - 12);
  const rot = useSharedValue(startRot.current);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    width: cardW,
    height: cardH,
    opacity: opacity.value,
    transform: [
      { rotate: `${rot.value}deg` },
      { scale: scale.value }
    ],
    zIndex: 5000 + index,
  }));

  useEffect(() => {
    let active = true;
    const delay = index * staggerMs;

    const timeoutId = setTimeout(() => {
      if (!active) return;

      maybePlaySound();

      // Make card visible at start of flight
      opacity.value = 1;

      const targetX = step.toX - cardW / 2;
      const targetY = step.toY - cardH / 2;

      x.value = withTiming(targetX, {
        duration: step.flightMs,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });

      y.value = withTiming(targetY, {
        duration: step.flightMs,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });

      scale.value = withSequence(
        withTiming(1.12, {
          duration: step.flightMs / 2,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1.0, {
          duration: step.flightMs / 2,
          easing: Easing.in(Easing.quad),
        })
      );

      rot.value = withTiming(0, {
        duration: step.flightMs,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }, (finished) => {
        if (finished && active) {
          runOnJS(onStepComplete)(step);
          
          // Smooth cross-fade once card lands to merge seamlessly
          opacity.value = withTiming(0, { duration: 60 }, (fadeDone) => {
            if (fadeDone && active) {
              runOnJS(onFinished)(step.id);
            }
          });
        }
      });
    }, delay);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [step, index, staggerMs, cardW, cardH, maybePlaySound, onStepComplete, onFinished]);

  return (
    <Animated.View style={style} pointerEvents="none">
      <Card
        card={step.card}
        faceDown={!step.card}
        width={cardW}
        height={cardH}
        noShadow={true}
      />
    </Animated.View>
  );
}

function CardFlightOverlayComponent({
  queue,
  onStepComplete,
  onComplete,
  onFlightSound,
  soundMode = "solo",
  staggerMs,
}: CardFlightOverlayProps) {
  const { cardSizes } = useGameLayoutContext();
  const { w: cardW, h: cardH } = cardSizes.small;

  const onStepCompleteRef = useRef(onStepComplete);
  const onCompleteRef = useRef(onComplete);
  const onFlightSoundRef = useRef(onFlightSound);
  const lastSoundAtRef = useRef(0);
  const onlineSoundPlayedRef = useRef(false);
  const finishedCountRef = useRef(0);

  onStepCompleteRef.current = onStepComplete;
  onCompleteRef.current = onComplete;
  onFlightSoundRef.current = onFlightSound;

  const resolvedStaggerMs = staggerMs ?? (soundMode === "online" ? 60 : 80);

  const maybePlaySound = useCallback(() => {
    if (!onFlightSoundRef.current || soundMode === "none") return;
    if (soundMode === "online") {
      if (onlineSoundPlayedRef.current) return;
      onlineSoundPlayedRef.current = true;
      onFlightSoundRef.current();
      return;
    }
    const now = Date.now();
    if (now - lastSoundAtRef.current < SOUND_THROTTLE_MS) return;
    lastSoundAtRef.current = now;
    onFlightSoundRef.current();
  }, [soundMode]);

  const handleCardFinished = useCallback((id: string) => {
    finishedCountRef.current += 1;
    if (finishedCountRef.current >= queue.length) {
      onCompleteRef.current();
    }
  }, [queue.length]);

  useEffect(() => {
    finishedCountRef.current = 0;
    onlineSoundPlayedRef.current = false;
    lastSoundAtRef.current = 0;

    if (queue.length === 0) return;

    const watchdogId = setTimeout(() => {
      onCompleteRef.current();
    }, cardFlightDurationMs(queue, resolvedStaggerMs) + WATCHDOG_BUFFER_MS);

    return () => {
      clearTimeout(watchdogId);
    };
  }, [queue, resolvedStaggerMs]);

  if (queue.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {queue.map((step, index) => (
        <FlyingCardItem
          key={step.id}
          step={step}
          index={index}
          staggerMs={resolvedStaggerMs}
          cardW={cardW}
          cardH={cardH}
          maybePlaySound={maybePlaySound}
          onStepComplete={onStepCompleteRef.current}
          onFinished={handleCardFinished}
        />
      ))}
    </View>
  );
}

export const CardFlightOverlay = React.memo(CardFlightOverlayComponent);
