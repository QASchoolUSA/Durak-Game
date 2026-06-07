import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useCardTheme } from "../theme/CardThemeContext";
import { cardSize, radius } from "../theme";

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
}

const SOUND_THROTTLE_MS = 200;
const WATCHDOG_BUFFER_MS = 2000;

function CardFlightOverlayComponent({
  queue,
  onStepComplete,
  onComplete,
  onFlightSound,
  soundMode = "solo",
}: CardFlightOverlayProps) {
  const theme = useCardTheme();
  const { w: cardW, h: cardH } = cardSize.small;

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const rot = useSharedValue(-8);
  const opacity = useSharedValue(0);

  const onStepCompleteRef = useRef(onStepComplete);
  const onCompleteRef = useRef(onComplete);
  const onFlightSoundRef = useRef(onFlightSound);
  const lastSoundAtRef = useRef(0);
  const onlineSoundPlayedRef = useRef(false);

  onStepCompleteRef.current = onStepComplete;
  onCompleteRef.current = onComplete;
  onFlightSoundRef.current = onFlightSound;

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    width: cardW,
    height: cardH,
    opacity: opacity.value,
    transform: [{ rotate: `${rot.value}deg` }],
    zIndex: 5000,
    borderRadius: radius.card,
    backgroundColor: theme.back,
    borderWidth: 1,
    borderColor: theme.backAccent,
  }));

  useEffect(() => {
    if (queue.length === 0) return;

    let cancelled = false;
    let watchdogId: ReturnType<typeof setTimeout> | null = null;
    let stepIndex = 0;

    onlineSoundPlayedRef.current = false;
    lastSoundAtRef.current = 0;

    const maybePlaySound = () => {
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
    };

    const finishRun = () => {
      if (cancelled) return;
      cancelled = true;
      opacity.value = 0;
      onCompleteRef.current();
    };

    const afterFade = () => {
      if (cancelled) return;
      advance();
    };

    const afterFlight = (step: CardFlightStep) => {
      if (cancelled) return;
      onStepCompleteRef.current(step);
      opacity.value = withTiming(0, { duration: 60 }, (fadeDone) => {
        if (fadeDone) runOnJS(afterFade)();
      });
    };

    const advance = () => {
      if (cancelled) return;

      if (stepIndex >= queue.length) {
        if (watchdogId) clearTimeout(watchdogId);
        finishRun();
        return;
      }

      const step = queue[stepIndex]!;
      stepIndex += 1;

      const startX = step.fromX - cardW / 2;
      const startY = step.fromY - cardH / 2;
      const targetX = step.toX - cardW / 2;
      const targetY = step.toY - cardH / 2;
      const duration = step.flightMs;

      x.value = startX;
      y.value = startY;
      rot.value = -8;
      opacity.value = 1;

      maybePlaySound();

      x.value = withTiming(targetX, { duration, easing: Easing.out(Easing.cubic) });
      y.value = withTiming(targetY, { duration, easing: Easing.out(Easing.cubic) });
      rot.value = withTiming(0, { duration }, (finished) => {
        if (finished) runOnJS(afterFlight)(step);
      });
    };

    watchdogId = setTimeout(() => {
      if (!cancelled) finishRun();
    }, cardFlightDurationMs(queue) + WATCHDOG_BUFFER_MS);

    advance();

    return () => {
      cancelled = true;
      if (watchdogId) clearTimeout(watchdogId);
      opacity.value = 0;
    };
  }, [queue, cardW, cardH, x, y, rot, opacity, soundMode]);

  if (queue.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={style} />
    </View>
  );
}

export const CardFlightOverlay = React.memo(CardFlightOverlayComponent);
