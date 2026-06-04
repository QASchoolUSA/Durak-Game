import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { Card as CardModel, Suit } from "@durak/game-core";
import { SUIT_SYMBOLS, isRed } from "@durak/game-core";
import { Card } from "./Card";
import { sortHandForDisplay } from "../game/handSort";
import { CARD_ASPECT, colors, layoutFor, radius, spacing, typography } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";

const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

const GRAVE_CARD_W = 46;
const GRAVE_CARD_H = Math.round(GRAVE_CARD_W * CARD_ASPECT);
const GRID_GAP = spacing.sm;

const SUIT_ORDER: Suit[] = ["clubs", "diamonds", "hearts", "spades"];

const SUIT_NAMES: Record<Suit, string> = {
  clubs: "Clubs",
  diamonds: "Diamonds",
  hearts: "Hearts",
  spades: "Spades",
};

export interface GraveyardSheetProps {
  visible: boolean;
  onClose: () => void;
  cards: CardModel[];
  trumpSuit: Suit;
}

function GraveyardSummary({
  cards,
  trumpSuit,
}: {
  cards: CardModel[];
  trumpSuit: Suit;
}) {
  const ui = useUiTheme();
  const counts = useMemo(() => {
    const tally: Record<Suit, number> = {
      clubs: 0,
      diamonds: 0,
      hearts: 0,
      spades: 0,
    };
    for (const card of cards) {
      tally[card.suit]++;
    }
    return tally;
  }, [cards]);

  return (
    <View style={styles.summaryRow}>
      {SUIT_ORDER.map((suit) => (
        <Text
          key={suit}
          style={[
            styles.summaryItem,
            { color: ui.textMuted },
            suit === trumpSuit && { color: ui.accent },
          ]}
        >
          {SUIT_SYMBOLS[suit]}
          {counts[suit]}
        </Text>
      ))}
    </View>
  );
}

function SuitPanel({
  suit,
  suitCards,
  trumpSuit,
  columns,
}: {
  suit: Suit;
  suitCards: CardModel[];
  trumpSuit: Suit;
  columns: number;
}) {
  const ui = useUiTheme();
  const isTrump = suit === trumpSuit;
  const pipColor = isRed(suit) ? colors.suitRed : colors.suitBlack;

  return (
    <View
      style={[
        styles.suitPanel,
        {
          backgroundColor: ui.panelBg,
          borderColor: ui.panelBorderSoft,
        },
        isTrump && {
          borderColor: ui.panelBorder,
          backgroundColor: ui.accentSoft,
        },
      ]}
    >
      <View style={styles.suitPanelHeader}>
        <View style={styles.suitTitleRow}>
          <Text style={[styles.suitSymbol, { color: pipColor }]}>
            {SUIT_SYMBOLS[suit]}
          </Text>
          <Text style={[styles.suitName, { color: ui.textPrimary }]}>{SUIT_NAMES[suit]}</Text>
          {isTrump && (
            <View
              style={[
                styles.trumpBadge,
                {
                  backgroundColor: ui.accentSoft,
                  borderColor: ui.panelBorder,
                },
              ]}
            >
              <Text style={[styles.trumpBadgeText, { color: ui.accent }]}>Trump</Text>
            </View>
          )}
        </View>
        <View style={styles.countBadge}>
          <Text style={[styles.countBadgeText, { color: ui.accent }]}>{suitCards.length}</Text>
        </View>
      </View>

      <View
        style={[
          styles.grid,
          { width: columns * (GRAVE_CARD_W + GRID_GAP) - GRID_GAP },
        ]}
      >
        {suitCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            width={GRAVE_CARD_W}
            height={GRAVE_CARD_H}
            trump={isTrump}
          />
        ))}
      </View>
    </View>
  );
}

export function GraveyardSheet({ visible, onClose, cards, trumpSuit }: GraveyardSheetProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerH = Math.round(screenH * 0.72);
  const columns = layoutFor(screenW).isTablet ? 5 : 4;

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);

  const ty = useSharedValue(drawerH);
  const backdropO = useSharedValue(0);
  const drawerHSV = useSharedValue(drawerH);
  useEffect(() => { drawerHSV.value = drawerH; }, [drawerH, drawerHSV]);

  const sorted = useMemo(
    () => sortHandForDisplay(cards, trumpSuit),
    [cards, trumpSuit],
  );

  const grouped = useMemo(() => {
    const groups: { suit: Suit; cards: CardModel[] }[] = [];
    for (const suit of SUIT_ORDER) {
      const suitCards = sorted.filter((c) => c.suit === suit);
      if (suitCards.length > 0) {
        groups.push({ suit, cards: suitCards });
      }
    }
    return groups;
  }, [sorted]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value = withSpring(drawerH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [drawerH, ty, backdropO],
  );

  const handleClose = useCallback(() => {
    animateOut(() => { setModalVisible(false); onClose(); });
  }, [animateOut, onClose]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = drawerH;
      backdropO.value = 0;
      setModalVisible(true);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, drawerH, modalVisible, ty, backdropO, animateOut]);

  const onModalShow = useCallback(() => {
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO]);

  const swipeDown = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-22, 22])
    .onUpdate((e) => {
      const drag = Math.max(0, e.translationY);
      ty.value = drag;
      backdropO.value = Math.max(0, BACKDROP_FULL * (1 - drag / (drawerHSV.value * 0.55)));
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 650) {
        ty.value = withSpring(drawerHSV.value, SPRING_OUT, () => {
          runOnJS(setModalVisible)(false);
          runOnJS(onClose)();
        });
        backdropO.value = withTiming(0, { duration: 210 });
      } else {
        ty.value = withSpring(0, SPRING_IN);
        backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
      }
    });

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={onModalShow}
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { height: drawerH }, aSheet]}>
          <LinearGradient
            colors={sheetGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={[styles.topAccent, { backgroundColor: ui.panelBorder }]} />

          <GestureDetector gesture={swipeDown}>
            <View style={styles.topBar}>
              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: ui.accentMuted }]} />
              </View>
              <View style={styles.header}>
                <Text style={[styles.title, { color: ui.accent }]}>GRAVEYARD</Text>
                <Text style={[styles.headerSub, { color: ui.textFaint }]}>
                  {cards.length === 0
                    ? "No cards out of play yet"
                    : `${cards.length} card${cards.length === 1 ? "" : "s"} out of play`}
                </Text>
                {cards.length > 0 && (
                  <GraveyardSummary cards={cards} trumpSuit={trumpSuit} />
                )}
              </View>
            </View>
          </GestureDetector>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {cards.length === 0 ? (
              <Text style={[styles.empty, { color: ui.textMuted }]}>
                No cards yet — beaten pairs appear here after each successful defense.
              </Text>
            ) : (
              grouped.map(({ suit, cards: suitCards }) => (
                <SuitPanel
                  key={suit}
                  suit={suit}
                  suitCards={suitCards}
                  trumpSuit={trumpSuit}
                  columns={columns}
                />
              ))
            )}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  backdrop: { backgroundColor: "rgba(4,14,9,1)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    flexDirection: "column",
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: 44,
    right: 44,
    height: 1,
    borderRadius: 1,
  },
  topBar: {},
  handleWrap: { alignItems: "center", paddingTop: 14, paddingBottom: 8 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    letterSpacing: 3,
  },
  headerSub: {
    ...typography.caption,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  summaryItem: {
    ...typography.caption,
    fontWeight: "700",
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  scroll: { flex: 1 },
  content: {
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  empty: {
    ...typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.xl,
  },
  suitPanel: {
    width: "100%",
    borderRadius: radius.panel,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  suitPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  suitTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
  },
  suitSymbol: {
    fontSize: 20,
    fontWeight: "700",
  },
  suitName: {
    ...typography.heading,
    fontSize: 16,
  },
  trumpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  trumpBadgeText: {
    ...typography.micro,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countBadgeText: {
    ...typography.caption,
    fontWeight: "800",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    justifyContent: "flex-start",
    alignSelf: "center",
  },
});
