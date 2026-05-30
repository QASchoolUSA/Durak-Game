import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
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
import { type DragCardBounds } from "../game/dropZones";
import { cardSize } from "../theme";

const PLAY_THRESHOLD = 48;
const FLICK_VELOCITY = -800;
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };
const DEAL_SPRING = { damping: 20, stiffness: 260, mass: 0.65 };
const TOUCH_PAD_BOTTOM = 8;
/** Matches HandCard scale while dragging. */
const DRAG_SCALE = 1.12;

// Deck sits upper-right — new cards fly from there into their exact fan slot.
const DEAL_FROM_X = 130;
const DEAL_FROM_Y = -95;

interface LayoutSnapshot {
  width: number;
  total: number;
  spacing: number;
  cardW: number;
  cardH: number;
  handH: number;
}

function hitCard(
  x: number,
  y: number,
  slot: number,
  layout: LayoutSnapshot,
  padW: number,
  padH: number,
): boolean {
  "worklet";
  const { width, total, spacing, handH } = layout;
  const mid = (total - 1) / 2;
  const cx = width / 2 + (slot - mid) * spacing;
  const halfW = padW / 2;
  const bottom = handH - TOUCH_PAD_BOTTOM;
  const top = bottom - padH;
  return x >= cx - halfW && x <= cx + halfW && y >= top && y <= bottom;
}

function pickCardAt(
  x: number,
  y: number,
  layout: LayoutSnapshot,
  cardW: number,
  cardH: number,
  touchW: number,
  touchH: number,
): number {
  "worklet";
  const { total } = layout;
  for (let i = total - 1; i >= 0; i--) {
    if (hitCard(x, y, i, layout, cardW, cardH)) return i;
  }
  for (let i = total - 1; i >= 0; i--) {
    if (hitCard(x, y, i, layout, touchW, touchH)) return i;
  }
  const mid = (total - 1) / 2;
  const centerX = layout.width / 2;
  let best = 0;
  let bestDist = 1e9;
  for (let i = 0; i < total; i++) {
    const cx = centerX + (i - mid) * layout.spacing;
    const d = Math.abs(x - cx);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Dragged card bounds in hand-layer coordinates. */
function cardBoundsInLayer(
  slot: number,
  layout: LayoutSnapshot,
  cardW: number,
  cardH: number,
  translationX: number,
  translationY: number,
  pressLift: number,
): { centerX: number; centerY: number; halfW: number; halfH: number } {
  "worklet";
  const mid = (layout.total - 1) / 2;
  const centerX = layout.width / 2 + (slot - mid) * layout.spacing + translationX;
  const centerY = layout.handH - TOUCH_PAD_BOTTOM - cardH / 2 + translationY - pressLift;
  const halfW = (cardW * DRAG_SCALE) / 2;
  const halfH = (cardH * DRAG_SCALE) / 2;
  return { centerX, centerY, halfW, halfH };
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

  const transformStyle = useAnimatedStyle(() => {
    const isActive = activeSlot.value === slotIndex;
    const pressLift = isActive ? press.value * 5 : 0;
    const x = isActive ? restX + dragX.value : tx.value;
    const y = isActive ? restY + dragY.value - pressLift : ty.value;
    const r = isActive ? 0 : rot.value;
    const s = isActive ? 1.12 + press.value * 0.03 : 1;

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        // Pivot rotation around the bottom edge so corners stay in the viewport.
        { translateY: h / 2 },
        { rotate: `${r}deg` },
        { translateY: -h / 2 },
        { scale: s },
      ],
      shadowOpacity: isActive ? 0.28 + press.value * 0.35 : 0.22,
      shadowRadius: isActive ? 5 + press.value * 10 : 5,
      zIndex: isActive ? 10000 : slotIndex,
    };
  });

  return (
    <Animated.View
      exiting={FadeOut.duration(140)}
      pointerEvents="none"
      style={[
        styles.card,
        { width: w, height: h, marginLeft: -w / 2, bottom: TOUCH_PAD_BOTTOM },
        transformStyle,
      ]}
    >
      <Card card={card} width={w} height={h} trump={trump} />
    </Animated.View>
  );
}

export interface HandProps {
  cards: CardModel[];
  playableIds: Set<string>;
  interactive: boolean;
  trumpSuit: string;
  /** Tap or flick-up play (attack / defend on card — not transfer). */
  onPlay: (card: CardModel) => void;
  /** Drag released at screen coordinates — used for transfer / precise defend drops. */
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
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const press = useSharedValue(0);

  const layoutSV = useSharedValue<LayoutSnapshot>({
    width,
    total,
    spacing,
    cardW: w,
    cardH: h,
    handH: handHeight,
  });

  useEffect(() => {
    layoutSV.value = { width, total, spacing, cardW: w, cardH: h, handH: handHeight };
  }, [width, total, spacing, w, h, handHeight, layoutSV]);

  const tryPlayCard = (card: CardModel) => {
    if (!interactive || !playableIds.has(card.id)) return;
    onPlay(card);
  };

  const tryPlaySlot = (slot: number) => {
    const card = sortedCards[slot];
    if (card) tryPlayCard(card);
  };

  const setDragActive = (cardId: string | null) => {
    onDragActive?.(cardId);
  };

  const notifyDragMove = (bounds: DragCardBounds | null) => {
    onDragMove?.(bounds);
  };

  const aimToScreen = (layerBounds: {
    centerX: number;
    centerY: number;
    halfW: number;
    halfH: number;
  }) => {
    const origin = layerOriginRef.current;
    if (!origin) return;
    notifyDragMove({
      centerX: origin.x + layerBounds.centerX,
      centerY: origin.y + layerBounds.centerY,
      halfW: layerBounds.halfW,
      halfH: layerBounds.halfH,
    });
  };

  const clearDragAim = () => {
    layerOriginRef.current = null;
    notifyDragMove(null);
  };

  const cacheLayerOrigin = (cb: () => void) => {
    touchLayerRef.current?.measureInWindow((x, y) => {
      layerOriginRef.current = { x, y };
      cb();
    });
  };

  const notifyDragBegin = (slot: number) => {
    const card = sortedCards[slot];
    if (card && interactive && playableIds.has(card.id)) {
      onDragActive?.(card.id);
      onDragBegin?.();
    }
  };

  const tryDropAtScreen = (
    slot: number,
    layerBounds: { centerX: number; centerY: number; halfW: number; halfH: number },
  ) => {
    const card = sortedCards[slot];
    if (!card || !interactive || !playableIds.has(card.id)) return;
    const origin = layerOriginRef.current;
    if (!origin) return;
    if (onDropAt) {
      onDropAt(card, {
        centerX: origin.x + layerBounds.centerX,
        centerY: origin.y + layerBounds.centerY,
        halfW: layerBounds.halfW,
        halfH: layerBounds.halfH,
      });
      return;
    }
    tryPlayCard(card);
  };

  const beginDragSlot = (slot: number) => {
    cacheLayerOrigin(() => notifyDragBegin(slot));
  };

  const touchW = w + 24;
  const touchH = h + 20;

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const idx = pickCardAt(e.x, e.y, layoutSV.value, w, h, touchW, touchH);
      activeSlot.value = idx;
      dragX.value = 0;
      dragY.value = 0;
      press.value = withSpring(1, SPRING);
      if (idx >= 0) {
        runOnJS(beginDragSlot)(idx);
      }
    })
    .onUpdate((e) => {
      if (activeSlot.value < 0) return;
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      const idx = activeSlot.value;
      const lift = press.value * 5;
      const bounds = cardBoundsInLayer(
        idx,
        layoutSV.value,
        w,
        h,
        e.translationX,
        e.translationY,
        lift,
      );
      runOnJS(aimToScreen)(bounds);
    })
    .onEnd((e) => {
      const idx = activeSlot.value;
      if (idx < 0) return;
      const tapLike = Math.abs(e.translationX) < 18 && Math.abs(e.translationY) < 18;
      const dragged = !tapLike;
      if (dragged) {
        const lift = press.value * 5;
        const bounds = cardBoundsInLayer(
          idx,
          layoutSV.value,
          w,
          h,
          e.translationX,
          e.translationY,
          lift,
        );
        runOnJS(tryDropAtScreen)(idx, bounds);
      } else if (
        e.translationY < -PLAY_THRESHOLD ||
        e.velocityY < FLICK_VELOCITY ||
        tapLike
      ) {
        runOnJS(tryPlaySlot)(idx);
      }
      dragX.value = withSpring(0, SPRING);
      dragY.value = withSpring(0, SPRING);
    })
    .onFinalize(() => {
      activeSlot.value = -1;
      press.value = withSpring(0, SPRING);
      dragX.value = 0;
      dragY.value = 0;
      runOnJS(setDragActive)(null);
      runOnJS(clearDragAim)();
    });

  return (
    <View style={[styles.container, { height: handHeight }]}>
      <GestureDetector gesture={pan}>
        <View ref={touchLayerRef} style={[styles.touchLayer, { height: handHeight }]}>
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
});

export const Hand = React.memo(HandComponent);
