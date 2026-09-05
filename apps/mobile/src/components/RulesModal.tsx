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
import { useTranslation } from "react-i18next";
import { spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { sheetHorizontalFrame } from "../theme/gameLayout";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";

const SPRING_IN  = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

const SECTION_KEYS = [
  { title: "rules.goalTitle", body: "rules.goalBody" },
  { title: "rules.rankingTitle", body: "rules.rankingBody" },
  { title: "rules.attackingTitle", body: "rules.attackingBody" },
  { title: "rules.defendingTitle", body: "rules.defendingBody" },
  { title: "rules.takingTitle", body: "rules.takingBody" },
  { title: "rules.transferTitle", body: "rules.transferBody" },
  { title: "rules.endRoundTitle", body: "rules.endRoundBody" },
  { title: "rules.winningTitle", body: "rules.winningBody" },
  { title: "rules.abilitiesTitle", body: "rules.abilitiesBody" },
] as const;

export interface RulesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RulesModal({ visible, onClose }: RulesModalProps) {
  const { t } = useTranslation();
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const lay = useGameLayout();
  const drawerH = Math.min(
    Math.round(screenH * 0.90),
    screenH - insets.top - lay.s(spacing.md),
  );

  const sections = SECTION_KEYS.map((s) => ({
    title: t(s.title),
    body: t(s.body),
  }));

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(false);

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

        <Animated.View style={[styles.sheet, { height: drawerH, ...sheetHorizontalFrame(lay) }, aSheet]}>
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
                <Text style={[styles.title, { color: ui.accent }]}>{t("rules.title")}</Text>
                <Text style={[styles.headerSub, { color: ui.textPrimary }]}>
                  {t("common.swipeDownClose")}
                </Text>
              </View>
            </View>
          </GestureDetector>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, lay.s(spacing.lg)) + lay.s(spacing.lg) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.intro, { color: ui.textPrimary }]}>
              {t("rules.intro")}
            </Text>

            {sections.map((s) => (
              <View key={s.title} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: ui.accent }]} />
                  <Text style={[styles.sectionTitle, { color: ui.accent }]}>{s.title}</Text>
                </View>
                <Text style={[styles.sectionBody, { color: ui.textMuted }]}>{s.body}</Text>
              </View>
            ))}

            <View style={[styles.footer, { borderTopColor: ui.panelBorderSoft }]}>
              <Text style={[styles.footerText, { color: ui.textFaint }]}>
                {t("rules.footer")}
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
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },

  scroll: { flex: 1 },
  content: { padding: spacing.lg },
  intro: {
    ...typography.body,
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
  },
  sectionTitle: {
    ...typography.heading,
  },
  sectionBody: {
    ...typography.body,
    lineHeight: 22,
    paddingLeft: spacing.md,
  },
  footer: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
  },
  footerText: {
    ...typography.body,
  },
});
