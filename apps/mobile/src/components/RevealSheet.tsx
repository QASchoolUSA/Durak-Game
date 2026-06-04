import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { Card as CardModel, Suit } from "@durak/game-core";
import { Card } from "./Card";
import { sortHandForDisplay } from "../game/handSort";
import { useCardTheme } from "../theme/CardThemeContext";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { CARD_ASPECT, layoutFor, radius, spacing, typography } from "../theme";

const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;
const REVEAL_DISPLAY_MS = 4000;
const FLIP_DURATION_MS = 450;

/** Fraction of screen height for the reveal drawer (smaller than graveyard/config). */
const DRAWER_HEIGHT_RATIO = 0.52;

const REVEAL_CARD_W = 64;
const REVEAL_CARD_H = Math.round(REVEAL_CARD_W * CARD_ASPECT);
const GRID_GAP = spacing.sm;

export interface RevealOpponent {
  id: string;
  name: string;
  cards: CardModel[];
}

export interface RevealSheetProps {
  visible: boolean;
  onClose: () => void;
  trumpSuit: Suit;
  opponents: RevealOpponent[];
}

type RevealStep = "pickPlayer" | "pickCard" | "revealing";

function initialStep(opponents: RevealOpponent[]): RevealStep {
  return opponents.length > 1 ? "pickPlayer" : "pickCard";
}

function initialSelectedId(opponents: RevealOpponent[]): string | null {
  return opponents.length === 1 ? opponents[0]!.id : null;
}

const REVEAL_DISPLAY_CARD_W = Math.round(REVEAL_CARD_W * 2.55);
const REVEAL_DISPLAY_CARD_H = Math.round(REVEAL_DISPLAY_CARD_W * CARD_ASPECT);

function RevealCardBack({
  width = REVEAL_CARD_W,
  height = REVEAL_CARD_H,
}: {
  width?: number;
  height?: number;
}) {
  const theme = useCardTheme();
  return (
    <View
      style={[
        styles.cardBack,
        {
          width,
          height,
          backgroundColor: theme.back,
          borderColor: theme.backAccent,
        },
      ]}
    />
  );
}

function FlippableRevealCard({
  card,
  trumpSuit,
  onFlipComplete,
}: {
  card: CardModel;
  trumpSuit: Suit;
  onFlipComplete: () => void;
}) {
  const [flipDone, setFlipDone] = useState(false);
  const progress = useSharedValue(0);
  const isTrump = card.suit === trumpSuit;

  useEffect(() => {
    progress.value = 0;
    setFlipDone(false);
    progress.value = withTiming(1, { duration: FLIP_DURATION_MS }, (finished) => {
      if (finished) {
        runOnJS(setFlipDone)(true);
        runOnJS(onFlipComplete)();
      }
    });
  }, [card.id, progress, onFlipComplete]);

  const backStyle = useAnimatedStyle(() => ({
    opacity: progress.value < 0.5 ? 1 : 0,
    transform: [{ scaleX: interpolate(progress.value, [0, 0.5], [1, 0.02], "clamp") }],
  }));

  const faceStyle = useAnimatedStyle(() => ({
    opacity: progress.value >= 0.5 ? 1 : 0,
    transform: [{ scaleX: interpolate(progress.value, [0.5, 1], [0.02, 1], "clamp") }],
  }));

  if (flipDone) {
    return (
      <View style={styles.revealedCardWrap}>
        <Card
          card={card}
          width={REVEAL_DISPLAY_CARD_W}
          height={REVEAL_DISPLAY_CARD_H}
          trump={isTrump}
        />
      </View>
    );
  }

  return (
    <View style={styles.flipContainer}>
      <Animated.View style={[styles.flipSide, backStyle]} pointerEvents="none">
        <RevealCardBack width={REVEAL_DISPLAY_CARD_W} height={REVEAL_DISPLAY_CARD_H} />
      </Animated.View>
      <Animated.View style={[styles.flipSide, faceStyle]} pointerEvents="none">
        <Card
          card={card}
          width={REVEAL_DISPLAY_CARD_W}
          height={REVEAL_DISPLAY_CARD_H}
          trump={isTrump}
        />
      </Animated.View>
    </View>
  );
}

export function RevealSheet({ visible, onClose, trumpSuit, opponents }: RevealSheetProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerH = Math.round(screenH * DRAWER_HEIGHT_RATIO);
  const columns = layoutFor(screenW).isTablet ? 5 : 4;

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);
  const opponentsSnapshotRef = useRef<RevealOpponent[]>(opponents);
  const [step, setStep] = useState<RevealStep>("pickCard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealedCard, setRevealedCard] = useState<CardModel | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ty = useSharedValue(drawerH);
  const backdropO = useSharedValue(0);
  const drawerHSV = useSharedValue(drawerH);
  useEffect(() => {
    drawerHSV.value = drawerH;
  }, [drawerH, drawerHSV]);

  const snapshotOpponents = opponentsSnapshotRef.current;

  const clearAutoCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const resetFlowFromSnapshot = useCallback(() => {
    clearAutoCloseTimer();
    const snap = opponentsSnapshotRef.current;
    setStep(initialStep(snap));
    setSelectedId(initialSelectedId(snap));
    setRevealedCard(null);
  }, [clearAutoCloseTimer]);

  const finishCloseRef = useRef<() => void>(() => {});

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value = withSpring(drawerH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [drawerH, ty, backdropO],
  );

  const finishClose = useCallback(() => {
    clearAutoCloseTimer();
    resetFlowFromSnapshot();
    setModalVisible(false);
    onClose();
  }, [clearAutoCloseTimer, resetFlowFromSnapshot, onClose]);

  finishCloseRef.current = finishClose;

  const requestClose = useCallback(() => {
    clearAutoCloseTimer();
    animateOut(() => finishCloseRef.current());
  }, [clearAutoCloseTimer, animateOut]);

  const scheduleAutoClose = useCallback(() => {
    clearAutoCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      animateOut(() => finishCloseRef.current());
    }, REVEAL_DISPLAY_MS);
  }, [clearAutoCloseTimer, animateOut]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      opponentsSnapshotRef.current = opponents.map((o) => ({
        id: o.id,
        name: o.name,
        cards: [...o.cards],
      }));
      const snap = opponentsSnapshotRef.current;
      clearAutoCloseTimer();
      setStep(initialStep(snap));
      setSelectedId(initialSelectedId(snap));
      setRevealedCard(null);
      ty.value = drawerH;
      backdropO.value = 0;
      setModalVisible(true);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => {
        resetFlowFromSnapshot();
        setModalVisible(false);
      });
    }
    prevVisible.current = visible;
  }, [
    visible,
    drawerH,
    modalVisible,
    opponents,
    ty,
    backdropO,
    animateOut,
    clearAutoCloseTimer,
    resetFlowFromSnapshot,
  ]);

  useEffect(
    () => () => {
      clearAutoCloseTimer();
    },
    [clearAutoCloseTimer],
  );

  const onModalShow = useCallback(() => {
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO]);

  const handleSelectPlayer = useCallback((id: string) => {
    setSelectedId(id);
    setStep("pickCard");
  }, []);

  const handleSelectCard = useCallback((card: CardModel) => {
    setRevealedCard(card);
    setStep("revealing");
  }, []);

  const handleFlipComplete = useCallback(() => {
    scheduleAutoClose();
  }, [scheduleAutoClose]);

  const handleBackToPlayers = useCallback(() => {
    if (snapshotOpponents.length > 1) {
      setSelectedId(null);
      setStep("pickPlayer");
    }
  }, [snapshotOpponents.length]);

  const dismissFromSwipe = useCallback(() => {
    clearAutoCloseTimer();
    finishCloseRef.current();
  }, [clearAutoCloseTimer]);

  const swipeDown = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-22, 22])
        .onUpdate((e) => {
          const drag = Math.max(0, e.translationY);
          ty.value = drag;
          backdropO.value = Math.max(
            0,
            BACKDROP_FULL * (1 - drag / (drawerHSV.value * 0.55)),
          );
        })
        .onEnd((e) => {
          if (e.translationY > 110 || e.velocityY > 650) {
            ty.value = withSpring(drawerHSV.value, SPRING_OUT, () => {
              runOnJS(dismissFromSwipe)();
            });
            backdropO.value = withTiming(0, { duration: 210 });
          } else {
            ty.value = withSpring(0, SPRING_IN);
            backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
          }
        }),
    [ty, backdropO, drawerHSV, dismissFromSwipe],
  );

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  const selectedOpponent = useMemo(
    () => snapshotOpponents.find((o) => o.id === selectedId) ?? null,
    [snapshotOpponents, selectedId],
  );

  const sortedCards = useMemo(
    () =>
      selectedOpponent
        ? sortHandForDisplay(selectedOpponent.cards, trumpSuit)
        : [],
    [selectedOpponent, trumpSuit],
  );

  const headerTitle =
    step === "pickPlayer"
      ? "CHOOSE PLAYER"
      : step === "pickCard"
        ? `REVEAL — ${selectedOpponent?.name ?? ""}`
        : "REVEALED";

  const headerSub =
    step === "revealing"
      ? "Memorize this card…"
      : step === "pickCard"
        ? "Tap a card to peek · Swipe down to close"
        : "Pick an opponent with 2+ cards · Swipe down to close";

  const bodyPaddingBottom = Math.max(insets.bottom, spacing.lg) + spacing.lg;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={onModalShow}
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>

        <GestureDetector gesture={swipeDown}>
          <Animated.View style={[styles.sheet, { height: drawerH }, aSheet]}>
            <LinearGradient
              colors={sheetGradient}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={[styles.topAccent, { backgroundColor: ui.panelBorder }]} />

            <View style={styles.topBar}>
              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: ui.accentMuted }]} />
              </View>
              <View style={styles.header}>
                {step === "pickCard" && snapshotOpponents.length > 1 && (
                  <Pressable onPress={handleBackToPlayers} hitSlop={12} style={styles.backBtn}>
                    <Text style={[styles.backBtnText, { color: ui.accent }]}>← Players</Text>
                  </Pressable>
                )}
                <Text style={[styles.title, { color: ui.accent }]}>{headerTitle}</Text>
                <Text style={[styles.headerSub, { color: ui.textFaint }]}>{headerSub}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

            <View
              style={[
                styles.body,
                step === "revealing" && styles.bodyRevealing,
                { paddingBottom: bodyPaddingBottom },
              ]}
            >
              {step === "pickPlayer" && (
                <View style={styles.playerList}>
                  {snapshotOpponents.map((opp) => (
                    <Pressable
                      key={opp.id}
                      style={[
                        styles.playerRow,
                        {
                          backgroundColor: ui.panelBg,
                          borderColor: ui.panelBorderSoft,
                        },
                      ]}
                      onPress={() => handleSelectPlayer(opp.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Reveal card from ${opp.name}, ${opp.cards.length} cards`}
                    >
                      <View style={styles.playerInfo}>
                        <Text style={[styles.playerName, { color: ui.textPrimary }]}>{opp.name}</Text>
                        <Text style={[styles.playerCount, { color: ui.textMuted }]}>
                          {opp.cards.length} cards
                        </Text>
                      </View>
                      <Text style={[styles.playerChevron, { color: ui.accent }]}>›</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {step === "pickCard" && selectedOpponent && (
                <View
                  style={[
                    styles.grid,
                    { maxWidth: columns * (REVEAL_CARD_W + GRID_GAP) },
                  ]}
                >
                  {sortedCards.map((card) => (
                    <Pressable
                      key={card.id}
                      onPress={() => handleSelectCard(card)}
                      accessibilityRole="button"
                      accessibilityLabel="Reveal this card"
                    >
                      <RevealCardBack />
                    </Pressable>
                  ))}
                </View>
              )}

              {step === "revealing" && revealedCard && (
                <View style={styles.revealCenter}>
                  <FlippableRevealCard
                    card={revealedCard}
                    trumpSuit={trumpSuit}
                    onFlipComplete={handleFlipComplete}
                  />
                </View>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
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
  backBtn: { marginBottom: spacing.xs },
  backBtnText: {
    ...typography.caption,
    fontWeight: "700",
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
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  bodyRevealing: {
    justifyContent: "center",
  },
  cardBack: {
    borderRadius: 6,
    borderWidth: 1,
  },
  playerList: {
    width: "100%",
    gap: spacing.sm,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.panel,
    borderWidth: 1,
    padding: spacing.md,
  },
  playerInfo: { gap: 2 },
  playerName: {
    ...typography.heading,
    fontSize: 16,
  },
  playerCount: {
    ...typography.caption,
  },
  playerChevron: {
    fontSize: 24,
    fontWeight: "300",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    justifyContent: "flex-start",
    alignSelf: "center",
  },
  revealCenter: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: spacing.md,
  },
  revealedCardWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  flipContainer: {
    width: REVEAL_DISPLAY_CARD_W,
    height: REVEAL_DISPLAY_CARD_H,
    alignItems: "center",
    justifyContent: "center",
  },
  flipSide: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
