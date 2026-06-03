import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { colors, spacing, typography } from "../theme";

const SPRING_IN  = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

const SECTIONS = [
  {
    title: "The Goal",
    body: "Be the first player to play all cards from your hand. The last player left holding cards is the Durak (fool).",
  },
  {
    title: "Card Ranking",
    body: "Cards rank from lowest to highest: 6 · 7 · 8 · 9 · 10 · J · Q · K · A\n\nThe trump suit beats any non-trump card, regardless of rank. Within the same suit, higher rank wins.",
  },
  {
    title: "Attacking",
    body: "The attacker places one or more cards of the same rank on the table. After the first card, other non-defender players may also throw in cards matching any rank already on the table.",
  },
  {
    title: "Defending",
    body: "The defender must cover each attack card with a higher card of the same suit, or any trump card. If the defender cannot or chooses not to defend, they take all table cards into their hand.",
  },
  {
    title: "Taking Cards",
    body: "If the defender takes cards, they pick up everything on the table and do NOT discard. Other attackers may continue throwing in before the defender takes.",
  },
  {
    title: "Perevodnoy — Transfer",
    body: "In Perevodnoy mode, the defender has a third option: play a card of the same rank as the initial attack. This transfers the entire attack to the next player, who now must defend.\n\nTransfer is only possible on the opening attack (one card on the table) and before any throw-ins.",
  },
  {
    title: "End of Round",
    body: "When all attacks are defended (or taken), the round ends. Players draw back up to 6 cards from the deck starting with the attacker. Once the deck is empty, no draws occur.",
  },
  {
    title: "Winning",
    body: "A player leaves the game as soon as their hand is empty and the deck is empty. The last player with cards is the Durak and loses the round.",
  },
];

export interface RulesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RulesModal({ visible, onClose }: RulesModalProps) {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerH = Math.round(screenH * 0.90);

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);

  const ty        = useSharedValue(drawerH);
  const backdropO = useSharedValue(0);
  const drawerHSV = useSharedValue(drawerH);
  useEffect(() => { drawerHSV.value = drawerH; }, [drawerH, drawerHSV]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value        = withSpring(drawerH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [drawerH, ty, backdropO],
  );

  const handleClose = useCallback(() => {
    animateOut(() => { setModalVisible(false); onClose(); });
  }, [animateOut, onClose]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = drawerH; backdropO.value = 0;
      setModalVisible(true);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, drawerH, modalVisible, ty, backdropO, animateOut]);

  const onModalShow = useCallback(() => {
    ty.value        = withSpring(0, SPRING_IN);
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
        ty.value        = withSpring(0, SPRING_IN);
        backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
      }
    });

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet    = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

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
            colors={[colors.feltMid, colors.feltBottom]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={styles.topAccent} />

          <GestureDetector gesture={swipeDown}>
            <View style={styles.topBar}>
              <View style={styles.handleWrap}>
                <View style={styles.handle} />
              </View>
              <View style={styles.header}>
                <Text style={styles.title}>HOW TO PLAY</Text>
                <Text style={styles.headerSub}>Swipe down to close</Text>
              </View>
            </View>
          </GestureDetector>

          <View style={styles.divider} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.intro}>
              Durak (Дурак) is one of Russia's most beloved card games. Simple to
              learn, rich in strategy — the last player with cards is the fool.
            </Text>

            {SECTIONS.map((s) => (
              <View key={s.title} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.dot} />
                  <Text style={styles.sectionTitle}>{s.title}</Text>
                </View>
                <Text style={styles.sectionBody}>{s.body}</Text>
              </View>
            ))}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                🃏 Good luck — and don't be the Durak!
              </Text>
            </View>
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
    backgroundColor: "rgba(231,192,103,0.38)",
  },

  topBar: {},
  handleWrap: { alignItems: "center", paddingTop: 14, paddingBottom: 8 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.gold,
    letterSpacing: 3,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(231,192,103,0.12)",
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },

  scroll: { flex: 1 },
  content: { padding: spacing.lg },
  intro: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
    fontStyle: "italic",
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.gold,
  },
  sectionBody: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
    paddingLeft: spacing.md,
  },
  footer: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  footerText: {
    ...typography.body,
    color: colors.textFaint,
  },
});
