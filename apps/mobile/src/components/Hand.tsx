import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeOut,
  type SharedValue,
  runOnJS,
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
import {
  decodeHoverKey,
  hitTestDropZones,
  type WorkletDropZone,
} from "../game/dropZoneWorklet";
import { cardSize, radius } from "../theme";

const handCardClip =
  Platform.OS === "ios"
    ? ({ borderCurve: "continuous" as const } satisfies { borderCurve: "continuous" })
    : {};

const DRAG_RELEASE_THRESHOLD = 18;
const PLAY_UP_ENTER_Y = -(DRAG_RELEASE_THRESHOLD + 4);
const PLAY_UP_COMMIT_Y = -48;
const PLAY_UP_CANCEL_Y = -10;
const BROWSE_THRESHOLD = 12;
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };
const DEAL_SPRING = { damping: 20, stiffness: 260, mass: 0.65 };
const DRAG_SCALE = 1.12;
const PEEK_LIFT = 5;

const GESTURE_IDLE = 0;
const GESTURE_PEEK = 1;
const GESTURE_PLAY = 2;

const DEAL_FROM_X = 130;
const DEAL_FROM_Y = -95;

type LayerBounds = {
  centerX: number;
  centerY: number;
  halfW: number;
  halfH: number;
};

function clampSlot(slot: number, total: number): number {
  "worklet";
  if (total <= 0) return -1;
  return Math.max(0, Math.min(total - 1, slot));
}

function isPlayableSlot(slot: number, mask: boolean[]): boolean {
  "worklet";
  return slot >= 0 && slot < mask.length && mask[slot] === true;
}

function cardBoundsInLayer(
  slot: number,
  layout: HandHitLayout,
  translationX: number,
  translationY: number,
  pressLift: number,
): LayerBounds {
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

function applyHoverKey(
  key: number,
  hoverDefendSV: SharedValue<number>,
  hoverTransferSV: SharedValue<number>,
): void {
  "worklet";
  if (key < 0) {
    hoverDefendSV.value = -1;
    hoverTransferSV.value = -1;
    return;
  }
  const decoded = decodeHoverKey(key);
  if (!decoded) {
    hoverDefendSV.value = -1;
    hoverTransferSV.value = -1;
    return;
  }
  if (decoded.kind === "defend") {
    hoverDefendSV.value = decoded.tableIndex;
    hoverTransferSV.value = -1;
  } else {
    hoverDefendSV.value = -1;
    hoverTransferSV.value = decoded.tableIndex;
  }
}

interface HandCardProps {
  card: CardModel;
  slotIndex: number;
  total: number;
  layoutWidth: number;
  spacing: number;
  rotPerSlot: number;
  trump: boolean;
  isNew: boolean;
  instantDeal: boolean;
  activeSlot: SharedValue<number>;
  gestureMode: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  press: SharedValue<number>;
}

const HandCard = React.memo(function HandCard({
  card,
  slotIndex,
  total,
  layoutWidth,
  spacing,
  rotPerSlot,
  trump,
  isNew,
  instantDeal,
  activeSlot,
  gestureMode,
  dragX,
  dragY,
  press,
}: HandCardProps) {
  const { w, h } = cardSize.hand;
  const mid = (total - 1) / 2;
  const rel = slotIndex - mid;

  const restX = layoutWidth / 2 + rel * spacing;
  const restY = 0;
  const restRot = rel * rotPerSlot;

  const tx = useSharedValue(isNew ? restX + DEAL_FROM_X : restX);
  const ty = useSharedValue(isNew ? restY + DEAL_FROM_Y : restY);
  const rot = useSharedValue(isNew ? restRot + 12 : restRot);
  const dealtRef = useRef(!isNew);

  useEffect(() => {
    if (activeSlot.value === slotIndex) return;

    if (instantDeal) {
      dealtRef.current = true;
      tx.value = restX;
      ty.value = restY;
      rot.value = restRot;
      return;
    }

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
  }, [restX, restY, restRot, isNew, instantDeal, tx, ty, rot, activeSlot, slotIndex, layoutWidth]);

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

  const cardTransformStyle = useAnimatedStyle(() => {
    const isElevated = activeSlot.value === slotIndex;
    const fanTouchActive = activeSlot.value >= 0;

    if (isElevated) {
      const isPlayDrag = gestureMode.value === GESTURE_PLAY;
      const pressLift = press.value * PEEK_LIFT;
      const x = isPlayDrag ? restX + dragX.value : restX;
      const y = isPlayDrag ? restY + dragY.value - pressLift : restY - pressLift;
      const s = DRAG_SCALE + press.value * 0.03;
      return {
        opacity: 1,
        transform: [
          { translateX: x },
          { translateY: y },
          { translateY: h / 2 },
          { rotate: "0deg" },
          { translateY: -h / 2 },
          { scale: s },
        ],
      };
    }

    return {
      opacity: fanTouchActive ? 0.85 : 1,
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { translateY: h / 2 },
        { rotate: `${rot.value}deg` },
        { translateY: -h / 2 },
        { scale: 1 },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const isElevated = activeSlot.value === slotIndex;
    if (!isElevated) return { opacity: 0 };
    return { opacity: 0.22 + press.value * 0.35 };
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
        style={[
          styles.cardClip,
          { width: w, height: h, borderRadius: radius.card },
          handCardClip,
          cardTransformStyle,
        ]}
      >
        <Animated.View pointerEvents="none" style={[styles.dragGlow, glowStyle]} />
        <Card card={card} width={w} height={h} trump={trump} />
      </Animated.View>
    </Animated.View>
  );
});

export interface HandProps {
  cards: CardModel[];
  playableIds: Set<string>;
  interactive: boolean;
  trumpSuit: string;
  /** Skip staggered deal springs (online sync — avoids mount-time Reanimated burst). */
  instantDeal?: boolean;
  onPlay?: (card: CardModel) => void;
  onDropAt?: (card: CardModel, bounds: DragCardBounds) => void;
  onDragMove?: (bounds: DragCardBounds | null) => void;
  onDragBegin?: () => void;
  onDragActive?: (cardId: string | null) => void;
  onCardsDealt?: (count: number) => void;
  dropZonesSV?: SharedValue<WorkletDropZone[]>;
  hoverDefendIndexSV?: SharedValue<number>;
  hoverTransferIndexSV?: SharedValue<number>;
}

function HandComponent({
  cards,
  playableIds,
  interactive,
  trumpSuit,
  instantDeal = false,
  onPlay,
  onDropAt,
  onDragMove,
  onDragBegin,
  onDragActive,
  onCardsDealt,
  dropZonesSV,
  hoverDefendIndexSV,
  hoverTransferIndexSV,
}: HandProps) {
  const { width } = useWindowDimensions();
  const { w, h } = cardSize.hand;
  const touchLayerRef = useRef<View>(null);
  const layerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const mountedRef = useRef(true);
  const [gesturesEnabled, setGesturesEnabled] = useState(!instantDeal);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!instantDeal) {
      setGesturesEnabled(true);
      return;
    }
    setGesturesEnabled(false);
    const id = setTimeout(() => setGesturesEnabled(true), 600);
    return () => clearTimeout(id);
  }, [instantDeal]);

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

  const dealtFiredRef = useRef(false);
  useEffect(() => {
    if (newIdSet.size === 0) {
      dealtFiredRef.current = false;
      return;
    }
    if (instantDeal || dealtFiredRef.current || !onCardsDealt) return;
    dealtFiredRef.current = true;
    onCardsDealt(newIdSet.size);
  }, [newIdSet, onCardsDealt, instantDeal]);

  const total = sortedCards.length;
  const { spacing, rotPerSlot } = computeHandLayout(width, w, h, total);
  const handHeight = h + TOUCH_PAD_BOTTOM + 4;

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
  const layerOriginX = useSharedValue(-1);
  const layerOriginY = useSharedValue(-1);
  const lastHoverKey = useSharedValue(-1);

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
      layerOriginX.value = x;
      layerOriginY.value = y;
    });
  }, [layerOriginX, layerOriginY]);

  const setDragActive = useCallback(
    (cardId: string | null) => {
      onDragActive?.(cardId);
    },
    [onDragActive],
  );

  const notifyDragMove = useCallback(
    (bounds: DragCardBounds | null) => {
      onDragMove?.(bounds);
    },
    [onDragMove],
  );

  const emitAimFromLayer = useCallback(
    (layerBounds: LayerBounds, fingerLayerX: number, fingerLayerY: number) => {
      const origin = layerOriginRef.current;
      if (!origin) {
        reportLayerOrigin();
        return;
      }
      notifyDragMove({
        centerX: origin.x + layerBounds.centerX,
        centerY: origin.y + layerBounds.centerY,
        halfW: layerBounds.halfW,
        halfH: layerBounds.halfH,
        aimX: origin.x + fingerLayerX,
        aimY: origin.y + fingerLayerY,
      });
    },
    [notifyDragMove, reportLayerOrigin],
  );

  const clearDragAim = useCallback(() => {
    notifyDragMove(null);
  }, [notifyDragMove]);

  const notifyDragBegin = useCallback(
    (slot: number) => {
      const card = sortedCards[slot];
      if (card) {
        onDragActive?.(card.id);
        onDragBegin?.();
      }
    },
    [sortedCards, onDragActive, onDragBegin],
  );

  const tryDropAtScreen = useCallback(
    (
      slot: number,
      layerBounds: LayerBounds,
      fingerLayerX: number,
      fingerLayerY: number,
    ) => {
      const card = sortedCards[slot];
      if (!card || !interactive || !playableIds.has(card.id)) return;
      const cardId = card.id;
      touchLayerRef.current?.measureInWindow((ox, oy) => {
        if (!mountedRef.current) return;
        const current = sortedCards[slot];
        if (!current || current.id !== cardId) return;
        layerOriginRef.current = { x: ox, y: oy };
        layerOriginX.value = ox;
        layerOriginY.value = oy;
        if (onDropAt) {
          onDropAt(current, {
            centerX: ox + layerBounds.centerX,
            centerY: oy + layerBounds.centerY,
            halfW: layerBounds.halfW,
            halfH: layerBounds.halfH,
            aimX: ox + fingerLayerX,
            aimY: oy + fingerLayerY,
          });
          return;
        }
        if (onPlay) onPlay(current);
      });
    },
    [sortedCards, interactive, playableIds, onDropAt, onPlay, layerOriginX, layerOriginY],
  );

  const beginDragSlot = useCallback(
    (
      slot: number,
      layerBounds: LayerBounds,
      fingerLayerX: number,
      fingerLayerY: number,
    ) => {
      reportLayerOrigin();
      notifyDragBegin(slot);
      emitAimFromLayer(layerBounds, fingerLayerX, fingerLayerY);
    },
    [reportLayerOrigin, notifyDragBegin, emitAimFromLayer],
  );

  const cancelPlayDrag = useCallback(() => {
    setDragActive(null);
    clearDragAim();
    if (hoverDefendIndexSV) hoverDefendIndexSV.value = -1;
    if (hoverTransferIndexSV) hoverTransferIndexSV.value = -1;
    lastHoverKey.value = -1;
  }, [setDragActive, clearDragAim, hoverDefendIndexSV, hoverTransferIndexSV, lastHoverKey]);

  const handlersRef = useRef({
    beginDragSlot,
    cancelPlayDrag,
    tryDropAtScreen,
    emitAimFromLayer,
    setDragActive,
    clearDragAim,
  });
  handlersRef.current = {
    beginDragSlot,
    cancelPlayDrag,
    tryDropAtScreen,
    emitAimFromLayer,
    setDragActive,
    clearDragAim,
  };

  const jsBeginDragSlot = useCallback(
    (slot: number, bounds: LayerBounds, x: number, y: number) => {
      handlersRef.current.beginDragSlot(slot, bounds, x, y);
    },
    [],
  );
  const jsCancelPlayDrag = useCallback(() => {
    handlersRef.current.cancelPlayDrag();
  }, []);
  const jsTryDropAtScreen = useCallback(
    (slot: number, bounds: LayerBounds, x: number, y: number) => {
      handlersRef.current.tryDropAtScreen(slot, bounds, x, y);
    },
    [],
  );
  const jsEmitAimFromLayer = useCallback(
    (bounds: LayerBounds, x: number, y: number) => {
      handlersRef.current.emitAimFromLayer(bounds, x, y);
    },
    [],
  );
  const jsSetDragActive = useCallback((cardId: string | null) => {
    handlersRef.current.setDragActive(cardId);
  }, []);
  const jsClearDragAim = useCallback(() => {
    handlersRef.current.clearDragAim();
  }, []);

  const useWorkletHover = Boolean(
    dropZonesSV && hoverDefendIndexSV && hoverTransferIndexSV,
  );

  const pan = useMemo(() => {
    const hoverZonesSV = dropZonesSV;
    const hoverDefendSV = hoverDefendIndexSV;
    const hoverTransferSV = hoverTransferIndexSV;

    return Gesture.Pan()
      .enabled(total > 0 && gesturesEnabled)
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
              runOnJS(jsBeginDragSlot)(slot, startBounds, e.x, e.y);
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
          runOnJS(jsCancelPlayDrag)();
          return;
        }

        const { centerX: restCx, centerY: restCy } = cardRestCenter(slot, layout);
        dragX.value = e.x - grabOffsetX.value - restCx;
        dragY.value = e.y - grabOffsetY.value - restCy;

        const lift = press.value * PEEK_LIFT;
        const layerBounds = cardBoundsInLayer(slot, layout, dragX.value, dragY.value, lift);

        if (useWorkletHover && hoverZonesSV && hoverDefendSV && hoverTransferSV) {
          const ox = layerOriginX.value;
          const oy = layerOriginY.value;
          if (ox >= 0 && oy >= 0) {
            const key = hitTestDropZones(
              {
                centerX: ox + layerBounds.centerX,
                centerY: oy + layerBounds.centerY,
                halfW: layerBounds.halfW,
                halfH: layerBounds.halfH,
                aimX: ox + e.x,
                aimY: oy + e.y,
              },
              hoverZonesSV.value,
            );
            if (key !== lastHoverKey.value) {
              lastHoverKey.value = key;
              applyHoverKey(key, hoverDefendSV, hoverTransferSV);
            }
          }
        } else {
          runOnJS(jsEmitAimFromLayer)(layerBounds, e.x, e.y);
        }
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
            runOnJS(jsTryDropAtScreen)(idx, bounds, e.x, e.y);
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
        lastHoverKey.value = -1;

        if (wasPlay) {
          runOnJS(jsSetDragActive)(null);
          runOnJS(jsClearDragAim)();
          if (hoverDefendSV) hoverDefendSV.value = -1;
          if (hoverTransferSV) hoverTransferSV.value = -1;
        }
      });
  }, [
    total,
    gesturesEnabled,
    useWorkletHover,
    dropZonesSV,
    hoverDefendIndexSV,
    hoverTransferIndexSV,
    jsBeginDragSlot,
    jsCancelPlayDrag,
    jsTryDropAtScreen,
    jsEmitAimFromLayer,
    jsSetDragActive,
    jsClearDragAim,
    activeSlot,
    gestureMode,
    browseAnchorSlot,
    playDragNotified,
    dragX,
    dragY,
    press,
    grabOffsetX,
    grabOffsetY,
    playableMaskSV,
    layoutSV,
    layerOriginX,
    layerOriginY,
    lastHoverKey,
  ]);

  return (
    <View style={[styles.container, { height: handHeight }]}>
      <GestureDetector gesture={pan}>
        <View
          ref={touchLayerRef}
          onLayout={reportLayerOrigin}
          style={[styles.touchLayer, { height: handHeight }]}
        >
          <View style={[styles.fanHost, { height: handHeight }]}>
            {sortedCards.map((card, slotIndex) => (
              <HandCard
                key={card.id}
                card={card}
                slotIndex={slotIndex}
                total={total}
                layoutWidth={width}
                spacing={spacing}
                rotPerSlot={rotPerSlot}
                trump={card.suit === trumpSuit}
                isNew={!instantDeal && newIdSet.has(card.id)}
                instantDeal={instantDeal}
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
  fanHost: {
    alignSelf: "stretch",
    width: "100%",
    overflow: "visible",
  },
  card: { position: "absolute" },
  cardClip: { overflow: "hidden" },
  dragGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
    borderRadius: radius.card,
  },
});

export const Hand = React.memo(HandComponent);
