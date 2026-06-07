import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { Card as CardModel, Suit } from "@durak/game-core";
import { Card } from "./Card";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, spacing, typography } from "../theme";

const FLIP_DURATION_MS = 450;
const CARD_W = 164;
const CARD_H = Math.round(CARD_W * 1.38);

export interface PendingRevealOverlayProps {
  card: CardModel | null;
  expiresAt: number;
  trumpSuit: Suit;
  onDismiss: () => void;
}

function FlippableCard({
  card,
  trumpSuit,
  onFlipComplete,
}: {
  card: CardModel;
  trumpSuit: Suit;
  onFlipComplete: () => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: FLIP_DURATION_MS }, (finished) => {
      if (finished) runOnJS(onFlipComplete)();
    });
  }, [card.id, progress, onFlipComplete]);

  const backStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.49, 0.5, 1], [1, 1, 0, 0]),
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const faceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.49, 0.5, 1], [0, 0, 1, 1]),
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(progress.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  return (
    <View style={styles.flipHost}>
      <Animated.View style={[styles.flipFace, backStyle]}>
        <Card faceDown width={CARD_W} height={CARD_H} compact />
      </Animated.View>
      <Animated.View style={[styles.flipFace, faceStyle]}>
        <Card card={card} width={CARD_W} height={CARD_H} trump={card.suit === trumpSuit} />
      </Animated.View>
    </View>
  );
}

export function PendingRevealOverlay({
  card,
  expiresAt,
  trumpSuit,
  onDismiss,
}: PendingRevealOverlayProps) {
  const ui = useUiTheme();
  const visible = card != null && expiresAt > Date.now();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flipDone, setFlipDone] = useState(false);

  const scheduleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const remaining = Math.max(0, expiresAt - Date.now());
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onDismiss();
    }, remaining);
  }, [expiresAt, onDismiss]);

  useEffect(() => {
    if (!visible) {
      setFlipDone(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    if (flipDone) scheduleDismiss();
  }, [visible, flipDone, scheduleDismiss]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  if (!visible || !card) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: ui.accent }]}>REVEALED</Text>
          <Text style={[styles.sub, { color: ui.textMuted }]}>Memorize this card…</Text>
          <FlippableCard
            card={card}
            trumpSuit={trumpSuit}
            onFlipComplete={() => setFlipDone(true)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  panel: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.panel,
    backgroundColor: "rgba(12, 45, 34, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  title: {
    ...typography.caption,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  sub: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  flipHost: {
    width: CARD_W,
    height: CARD_H,
  },
  flipFace: {
    ...StyleSheet.absoluteFill,
    backfaceVisibility: "hidden",
  },
});
