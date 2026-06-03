import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeOut,
  type SharedValue,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { type Card as CardModel, type Suit } from "@durak/game-core";
import { Card } from "./Card";
import { sortHandForDisplay } from "../game/handSort";
import { computeHandLayout } from "../game/handLayout";
import {
  TOUCH_PAD_BOTTOM,
  cardRestCenter,
  pickCardAt,
  type HandHitLayout,
} from "../game/handHitTest";
import { type DragCardBounds } from "../game/dropZones";
import { cardSize, radius } from "../theme";

const handCardClip =
  Platform.OS === "ios"
    ? ({ borderCurve: "continuous" as const } satisfies { borderCurve: "continuous" })
    : {};

/** Minimum drag distance (px) before a release counts as a play attempt. */
const DRAG_RELEASE_THRESHOLD = 18;
/** Finger moved up (toward table) to enter play-drag. Negative Y = up. */
const PLAY_UP_ENTER_Y = -(DRAG_RELEASE_THRESHOLD + 4);
/** Card must end this far up (layer Y) to commit play on release. */
const PLAY_UP_COMMIT_Y = -48;
/** Pull back above this (less upward) to leave play-drag mid-gesture. */
const PLAY_UP_CANCEL_Y = -10;
const BROWSE_THRESHOLD = 12;
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };
const DEAL_SPRING = { damping: 20, stiffness: 260, mass: 0.65 };
/** Matches HandCard scale while dragging. */
const DRAG_SCALE = 1.12;
const PEEK_LIFT = 5;

const GESTURE_IDLE = 0;
const GESTURE_PEEK = 1;
const GESTURE_PLAY = 2;

// Deck sits upper-right — new cards fly from there into their exact fan slot.
const DEAL_FROM_X = 130;
const DEAL_FROM_Y = -95;

function clampSlot(slot: number, total: number): number {
  "worklet";
  if (total <= 0) return -1;
  return Math.max(0, Math.min(total - 1, slot));
}

function isPlayableSlot(slot: number, mask: boolean[]): boolean {
  "worklet";
  return slot >= 0 && slot < mask.length && mask[slot] === true;
}

/** Dragged card bounds in hand-layer coordinates. */
function cardBoundsInLayer(
  slot: number,
  layout: HandHitLayout,
  translationX: number,
  translationY: number,
  pressLift: number,
): { centerX: number; centerY: number; halfW: number; halfH: number } {
  "worklet";
  const { centerX, centerY } = cardRestCenter(slot, layout);
  const halfW = (layout.cardW * DRAG_SCALE) / 2;
  const halfH = (layout.cardH * DRAG_SCALE) / 2;
  return {
    centerX: centerX + translationX,
    centerY: centerY + translationY - pressLift,
    halfW,
    halfH,
  };
}

interface HandCardProps {
  card: CardModel;
  slotIndex: number;
  total: number;
  spacing: number;
  rotPerSlot: number;
  trump: boolean;
  isNew: boolean;
  activeSlot: SharedValue<number>;
  gestureMode: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  press: SharedValue<number>;
}

function HandCard({
  card,
  slotIndex,
  total,
  spacing,
  rotPerSlot,
  trump,
  isNew,
  activeSlot,
  gestureMode,
  dragX,
  dragY,
  press,
}: HandCardProps) {
  const { w, h } = cardSize.hand;
  const mid = (total - 1) / 2;
  const rel = slotIndex - mid;

  const restX = rel * spacing;
  const restY = 0;
  const restRot = rel * rotPerSlot;

  const tx = useSharedValue(isNew ? restX + DEAL_FROM_X : restX);
  const ty = useSharedValue(isNew ? restY + DEAL_FROM_Y : restY);
  const rot = useSharedValue(isNew ? restRot + 12 : restRot);
  const dealtRef = useRef(!isNew);

  useEffect(() => {
    if (activeSlot.value === slotIndex) return;

    if (!dealtRef.current && isNew) {
      dealtRef.current = true;
      const stagger = slotIndex * 38;
      tx.value = restX + DEAL_FROM_X;
      ty.value = restY + DEAL_FROM_Y;
      rot.value = restRot + 12;
      tx.value = withDelay(stagger, withSpring(restX, DEAL_SPRING));
      ty.value = withDelay(stagger, withSpring(restY, DEAL_SPRING));
      rot.value = withDelay(stagger, withSpring(restRot, DEAL_SPRING));
      return;
    }

    tx.value = withSpring(restX, SPRING);
    ty.value = withSpring(restY, SPRING);
    rot.value = withSpring(restRot, SPRING);
  }, [restX, restY, restRot, isNew, tx, ty, rot, activeSlot, slotIndex]);

  useAnimatedReaction(
    () => activeSlot.value,
    (cur, prev) => {
      if (prev === slotIndex && cur !== slotIndex) {
        tx.value = withSpring(restX, SPRING);
        ty.value = withSpring(restY, SPRING);
        rot.value = withSpring(restRot, SPRING);
      }
    },
  );

  const wrapperStyle = useAnimatedStyle(() => ({
    zIndex: activeSlot.value === slotIndex ? 10000 : slotIndex,
  }));

  const rasterProps = useAnimatedProps(() => {
    const isElevated = activeSlot.value === slotIndex;
    const inFan = total > 1 && !isElevated;
    return {
      shouldRasterizeIOS: inFan,
      renderToHardwareTextureAndroid: inFan,
    };
  });

  const transformStyle = useAnimatedStyle(() => {
    const isElevated = activeSlot.value === slotIndex;
    const isPlayDrag = gestureMode.value === GESTURE_PLAY && isElevated;
    const fanTouchActive = activeSlot.value >= 0;

    const pressLift = isElevated ? press.value * PEEK_LIFT : 0;

    const x = isPlayDrag ? restX + dragX.value : isElevated ? restX : tx.value;
    const y = isPlayDrag ? restY + dragY.value - pressLift : isElevated ? restY - pressLift : ty.value;
    const r = isElevated ? 0 : rot.value;
    const s = isElevated ? 1.12 + press.value * 0.03 : 1;

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { translateY: h / 2 },
        { rotate: `${r}deg` },
        { translateY: -h / 2 },
        { scale: s },
      ],
      opacity: fanTouchActive && !isElevated ? 0.85 : 1,
      shadowOpacity: isElevated ? 0.28 + press.value * 0.35 : 0.22,
      shadowRadius: isElevated ? 5 + press.value * 10 : 5,
    };
  });

  return (
    <Animated.View
      exiting={FadeOut.duration(140)}
      pointerEvents="none"
      style={[
        styles.card,
        { width: w, height: h, marginLeft: -w / 2, bottom: TOUCH_PAD_BOTTOM },
        wrapperStyle,
      ]}
    >
      <Animated.View
        animatedProps={rasterProps}
        style={[
          styles.cardClip,
          { width: w, height: h, borderRadius: radius.card },
          handCardClip,
          transformStyle,
        ]}
      >
        <Card card={card} width={w} height={h} trump={trump} />
      </Animated.View>
    </Animated.View>
  );
}

export interface HandProps {
  cards: CardModel[];
  playableIds: Set<string>;
  interactive: boolean;
  trumpSuit: string;
  /** Fallback when onDropAt is omitted — normal play uses drag + onDropAt only. */
  onPlay?: (card: CardModel) => void;
  /** Drag released at screen coordinates — play / transfer / defend drops. */
  onDropAt?: (card: CardModel, bounds: DragCardBounds) => void;
  /** Card bounds while dragging — used to preview the active drop target. */
  onDragMove?: (bounds: DragCardBounds | null) => void;
  /** Fired when a drag starts so the table can refresh drop-zone measurements. */
  onDragBegin?: () => void;
  onDragActive?: (cardId: string | null) => void;
}

function HandComponent({
  cards,
  playableIds,
  interactive,
  trumpSuit,
  onPlay,
  onDropAt,
  onDragMove,
  onDragBegin,
  onDragActive,
}: HandProps) {
  const { width } = useWindowDimensions();
  const { w, h } = cardSize.hand;
  const touchLayerRef = useRef<View>(null);
  const layerOriginRef = useRef<{ x: number; y: number } | null>(null);

  const sortedCards = useMemo(
    () => sortHandForDisplay(cards, trumpSuit as Suit),
    [cards, trumpSuit],
  );

  const prevIdsRef = useRef<Set<string>>(new Set());
  const newIdSet = useMemo(() => {
    const prev = prevIdsRef.current;
    const added = new Set<string>();
    for (const c of sortedCards) {
      if (!prev.has(c.id)) added.add(c.id);
    }
    return added;
  }, [sortedCards]);

  useEffect(() => {
    prevIdsRef.current = new Set(sortedCards.map((c) => c.id));
  }, [sortedCards]);

  const total = sortedCards.length;
  const { spacing, rotPerSlot } = computeHandLayout(width, w, h, total);
  const handHeight = h + TOUCH_PAD_BOTTOM + 12;

  const activeSlot = useSharedValue(-1);
  const gestureMode = useSharedValue(GESTURE_IDLE);
  const browseAnchorSlot = useSharedValue(0);
  const playDragNotified = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const press = useSharedValue(0);
  const grabOffsetX = useSharedValue(0);
  const grabOffsetY = useSharedValue(0);
  const playableMaskSV = useSharedValue<boolean[]>([]);

  const layoutSV = useSharedValue<HandHitLayout>({
    width,
    total,
    spacing,
    rotPerSlot,
    cardW: w,
    cardH: h,
    handH: handHeight,
  });

  useEffect(() => {
    layoutSV.value = {
      width,
      total,
      spacing,
      rotPerSlot,
      cardW: w,
      cardH: h,
      handH: handHeight,
    };
  }, [width, total, spacing, rotPerSlot, w, h, handHeight, layoutSV]);

  useEffect(() => {
    playableMaskSV.value = sortedCards.map(
      (c) => interactive && playableIds.has(c.id),
    );
  }, [sortedCards, interactive, playableIds, playableMaskSV]);

  const reportLayerOrigin = useCallback(() => {
    touchLayerRef.current?.measureInWindow((x, y) => {
      layerOriginRef.current = { x, y };
    });
  }, []);

  const setDragActive = (cardId: string | null) => {
    onDragActive?.(cardId);
  };

  const notifyDragMove = (bounds: DragCardBounds | null) => {
    onDragMove?.(bounds);
  };

  const emitAim = useCallback(
    (
      layerBounds: { centerX: number; centerY: number; halfW: number; halfH: number },
      fingerLayerX: number,
      fingerLayerY: number,
    ) => {
      touchLayerRef.current?.measureInWindow((ox, oy) => {
        layerOriginRef.current = { x: ox, y: oy };
        notifyDragMove({
          centerX: ox + layerBounds.centerX,
          centerY: oy + layerBounds.centerY,
          halfW: layerBounds.halfW,
          halfH: layerBounds.halfH,
          aimX: ox + fingerLayerX,
          aimY: oy + fingerLayerY,
        });
      });
    },
    [],
  );

  const clearDragAim = () => {
    notifyDragMove(null);
  };

  const notifyDragBegin = (slot: number) => {
    const card = sortedCards[slot];
    if (card) {
      onDragActive?.(card.id);
      onDragBegin?.();
    }
  };

  const tryDropAtScreen = (
    slot: number,
    layerBounds: { centerX: number; centerY: number; halfW: number; halfH: number },
    fingerLayerX: number,
    fingerLayerY: number,
  ) => {
    const card = sortedCards[slot];
    if (!card || !interactive || !playableIds.has(card.id)) return;
    touchLayerRef.current?.measureInWindow((ox, oy) => {
      layerOriginRef.current = { x: ox, y: oy };
      if (onDropAt) {
        onDropAt(card, {
          centerX: ox + layerBounds.centerX,
          centerY: oy + layerBounds.centerY,
          halfW: layerBounds.halfW,
          halfH: layerBounds.halfH,
          aimX: ox + fingerLayerX,
          aimY: oy + fingerLayerY,
        });
        return;
      }
      if (onPlay) onPlay(card);
    });
  };

  const beginDragSlot = (
    slot: number,
    layerBounds: { centerX: number; centerY: number; halfW: number; halfH: number },
    fingerLayerX: number,
    fingerLayerY: number,
  ) => {
    notifyDragBegin(slot);
    emitAim(layerBounds, fingerLayerX, fingerLayerY);
  };

  const cancelPlayDrag = () => {
    setDragActive(null);
    clearDragAim();
  };

  const pan = Gesture.Pan()
    .enabled(total > 0)
    .minDistance(0)
    .onBegin((e) => {
      const layout = layoutSV.value;
      const idx = pickCardAt(e.x, e.y, layout);

      playDragNotified.value = 0;
      gestureMode.value = GESTURE_PEEK;
      if (idx < 0) {
        activeSlot.value = -1;
        press.value = withSpring(0, SPRING);
        gestureMode.value = GESTURE_IDLE;
        return;
      }

      activeSlot.value = idx;
      browseAnchorSlot.value = idx;
      dragX.value = 0;
      dragY.value = 0;
      press.value = withSpring(1, SPRING);
    })
    .onUpdate((e) => {
      if (activeSlot.value < 0) return;

      const layout = layoutSV.value;
      const mask = playableMaskSV.value;
      let slot = activeSlot.value;
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);

      if (gestureMode.value !== GESTURE_PLAY) {
        const canPlay = isPlayableSlot(slot, mask);
        const upAmount = -e.translationY;

        if (canPlay && e.translationY <= PLAY_UP_ENTER_Y && upAmount > absX) {
          gestureMode.value = GESTURE_PLAY;
          const { centerX, centerY } = cardRestCenter(slot, layout);
          grabOffsetX.value = e.x - centerX;
          grabOffsetY.value = e.y - centerY;
          if (playDragNotified.value === 0) {
            playDragNotified.value = 1;
            const tx = e.x - grabOffsetX.value - centerX;
            const ty = e.y - grabOffsetY.value - centerY;
            const lift = press.value * PEEK_LIFT;
            const startBounds = cardBoundsInLayer(slot, layout, tx, ty, lift);
            runOnJS(beginDragSlot)(slot, startBounds, e.x, e.y);
          }
        } else if (absX >= BROWSE_THRESHOLD && absX > absY) {
          const delta = Math.round(e.translationX / layout.spacing);
          const newSlot = clampSlot(browseAnchorSlot.value + delta, layout.total);
          activeSlot.value = newSlot;
          slot = newSlot;
        }
      }

      if (gestureMode.value !== GESTURE_PLAY) return;

      if (e.translationY > PLAY_UP_CANCEL_Y) {
        gestureMode.value = GESTURE_PEEK;
        playDragNotified.value = 0;
        dragX.value = 0;
        dragY.value = 0;
        runOnJS(cancelPlayDrag)();
        return;
      }

      const { centerX: restCx, centerY: restCy } = cardRestCenter(slot, layout);
      dragX.value = e.x - grabOffsetX.value - restCx;
      dragY.value = e.y - grabOffsetY.value - restCy;

      const lift = press.value * PEEK_LIFT;
      const bounds = cardBoundsInLayer(slot, layout, dragX.value, dragY.value, lift);

      runOnJS(emitAim)(bounds, e.x, e.y);
    })
    .onEnd((e) => {
      const mode = gestureMode.value;
      const idx = activeSlot.value;
      const layout = layoutSV.value;

      if (idx >= 0 && mode === GESTURE_PLAY) {
        const { centerX: restCx, centerY: restCy } = cardRestCenter(idx, layout);
        const finalDragX = e.x - grabOffsetX.value - restCx;
        const finalDragY = e.y - grabOffsetY.value - restCy;
        const commitPlay = finalDragY <= PLAY_UP_COMMIT_Y;
        const lift = press.value * PEEK_LIFT;

        if (commitPlay) {
          const bounds = cardBoundsInLayer(idx, layout, finalDragX, finalDragY, lift);
          runOnJS(tryDropAtScreen)(idx, bounds, e.x, e.y);
        }
      }

      dragX.value = withSpring(0, SPRING);
      dragY.value = withSpring(0, SPRING);
    })
    .onFinalize(() => {
      const wasPlay = gestureMode.value === GESTURE_PLAY;

      activeSlot.value = -1;
      gestureMode.value = GESTURE_IDLE;
      playDragNotified.value = 0;
      dragX.value = 0;
      dragY.value = 0;
      press.value = withSpring(0, SPRING);

      if (wasPlay) {
        runOnJS(setDragActive)(null);
        runOnJS(clearDragAim)();
      }
    });

  return (
    <View style={[styles.container, { height: handHeight }]}>
      <GestureDetector gesture={pan}>
        <View
          ref={touchLayerRef}
          onLayout={reportLayerOrigin}
          style={[styles.touchLayer, { height: handHeight }]}
        >
          <View style={[styles.center, { height: handHeight }]}>
            {sortedCards.map((card, slotIndex) => (
              <HandCard
                key={card.id}
                card={card}
                slotIndex={slotIndex}
                total={total}
                spacing={spacing}
                rotPerSlot={rotPerSlot}
                trump={card.suit === trumpSuit}
                isNew={newIdSet.has(card.id)}
                activeSlot={activeSlot}
                gestureMode={gestureMode}
                dragX={dragX}
                dragY={dragY}
                press={press}
              />
            ))}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "flex-end", alignItems: "center", overflow: "visible" },
  touchLayer: { alignSelf: "stretch", width: "100%", overflow: "visible" },
  center: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "visible",
  },
  card: { position: "absolute" },
  cardClip: { overflow: "hidden" },
});

export const Hand = React.memo(HandComponent);
