import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
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
import type { GameVariant, ThrowInScope, PlayStyle } from "@durak/game-core";
import type { Difficulty } from "../game/store";
import { useGameStore } from "../game/store";
import { MenuButton } from "./MenuButton";
import { colors, radius, spacing, typography } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { trigger } from "../feedback/haptics";

// ── Static config ─────────────────────────────────────────────────────────────

const PLAYER_OPTIONS = [
  { count: 2, hint: "1 vs 1"  },
  { count: 3, hint: "vs 2 AI" },
  { count: 4, hint: "vs 3 AI" },
  { count: 5, hint: "vs 4 AI" },
  { count: 6, hint: "vs 5 AI" },
];

const VARIANTS: {
  id: GameVariant; icon: string; label: string; tag: string; desc: string;
}[] = [
  {
    id: "podkidnoy",
    icon: "♠",
    label: "Podkidnoy",
    tag: "CLASSIC",
    desc: "Cover the attacks or take all the cards.",
  },
  {
    id: "perevodnoy",
    icon: "↻",
    label: "Perevodnoy",
    tag: "TRANSFER",
    desc: "Hold the same rank? Pass the attack on.",
  },
];

const THROW_OPTIONS: { id: ThrowInScope; label: string; desc: string }[] = [
  { id: "all",      label: "All",       desc: "Any attacker can add" },
  { id: "neighbor", label: "Neighbors", desc: "Adjacent only"        },
];

const PLAY_STYLE_OPTIONS: { id: PlayStyle; label: string; desc: string }[] = [
  { id: "standard",  label: "Standard",       desc: "Classic Durak — no special powers" },
  { id: "abilities", label: "With Abilities", desc: "Return, graveyard & reveal a card" },
];

const DIFF_OPTIONS: {
  id: Difficulty; label: string; desc: string;
  pips: number; color: string; activeBg: string;
}[] = [
  { id: "easy",   label: "Easy",   desc: "Relaxed",  pips: 1, color: colors.success, activeBg: "rgba(70,167,88,0.14)"   },
  { id: "medium", label: "Medium", desc: "Balanced", pips: 3, color: colors.gold,    activeBg: "rgba(231,192,103,0.14)" },
  { id: "hard",   label: "Hard",   desc: "Expert",   pips: 5, color: colors.danger,  activeBg: "rgba(229,72,77,0.14)"   },
];

// ── Animation springs ─────────────────────────────────────────────────────────

const SPRING_IN  = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

// ── Drawer ────────────────────────────────────────────────────────────────────

export interface GameConfigDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function GameConfigDrawer({ visible, onClose }: GameConfigDrawerProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];
  const { height: screenH } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  const drawerH = Math.round(screenH * 0.88);

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);

  const ty        = useSharedValue(drawerH);
  const backdropO = useSharedValue(0);
  // Keep drawerH in a shared value so it's reachable from the gesture worklet
  const drawerHSV = useSharedValue(drawerH);
  useEffect(() => { drawerHSV.value = drawerH; }, [drawerH, drawerHSV]);

  // ── Internal open / close helpers ─────────────────────────────────────────

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

  // Sync external `visible` prop
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

  // ── Swipe-to-dismiss gesture ───────────────────────────────────────────────

  const swipeDown = Gesture.Pan()
    // Only activate on a clear downward stroke; sideways flicks fall through
    .activeOffsetY(10)
    .failOffsetX([-22, 22])
    .onUpdate((e) => {
      const drag = Math.max(0, e.translationY);
      ty.value = drag;
      // Backdrop fades as the drawer moves away
      backdropO.value = Math.max(0, BACKDROP_FULL * (1 - drag / (drawerHSV.value * 0.55)));
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 650) {
        // Dismiss
        ty.value = withSpring(drawerHSV.value, SPRING_OUT, () => {
          runOnJS(setModalVisible)(false);
          runOnJS(onClose)();
        });
        backdropO.value = withTiming(0, { duration: 210 });
      } else {
        // Snap back
        ty.value        = withSpring(0, SPRING_IN);
        backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
      }
    });

  // ── Store bindings ─────────────────────────────────────────────────────────

  const numPlayers  = useGameStore((s) => s.numPlayers);
  const variant     = useGameStore((s) => s.variant);
  const throwIn     = useGameStore((s) => s.throwInScope);
  const playStyle   = useGameStore((s) => s.playStyle);
  const difficulty  = useGameStore((s) => s.difficulty);
  const setPlayers  = useGameStore((s) => s.setNumPlayers);
  const setVariant  = useGameStore((s) => s.setVariant);
  const setThrowIn  = useGameStore((s) => s.setThrowInScope);
  const setPlayStyle = useGameStore((s) => s.setPlayStyle);
  const setDiff     = useGameStore((s) => s.setDifficulty);
  const startGame   = useGameStore((s) => s.startGame);

  const handleStart = useCallback(() => {
    trigger("gameStart");
    setModalVisible(false);
    onClose();
    startGame();
  }, [onClose, startGame]);

  // ── Animated styles ────────────────────────────────────────────────────────

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet    = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={onModalShow}
      onRequestClose={handleClose}
    >
      {/* GestureHandlerRootView is required for gestures inside a Modal */}
      <GestureHandlerRootView style={styles.gestureRoot}>

        {/* Backdrop — tap to close */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet — swipe-down-to-dismiss wraps the whole card */}
        <GestureDetector gesture={swipeDown}>
          <Animated.View style={[styles.sheet, { height: drawerH }, aSheet]}>

            {/* Gradient background */}
            <LinearGradient
              colors={sheetGradient}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            />
            <View style={[styles.topAccent, { backgroundColor: ui.panelBorder }]} />

            <View style={styles.topBar}>
              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: ui.accentMuted }]} />
              </View>
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: ui.accent }]}>NEW GAME</Text>
                <Text style={[styles.headerSub, { color: ui.textFaint }]}>
                  Swipe down to cancel
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

            {/* ── Non-scrollable sections ── */}
            <View style={styles.sections}>

              {/* Players */}
              <View style={styles.section}>
                <SectionLabel label="PLAYERS" />
                <View style={styles.playerRow}>
                  {PLAYER_OPTIONS.map((p) => (
                    <PlayerBtn
                      key={p.count}
                      count={p.count}
                      hint={p.hint}
                      active={numPlayers === p.count}
                      onPress={() => {
                        trigger("selection");
                        setPlayers(p.count);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={[styles.sectionSep, { backgroundColor: ui.panelBorderSoft }]} />

              {/* Game Mode */}
              <View style={styles.section}>
                <SectionLabel label="GAME MODE" />
                <View style={styles.modePair}>
                  {VARIANTS.map((v) => (
                    <ModeCard
                      key={v.id}
                      icon={v.icon}
                      label={v.label}
                      tag={v.tag}
                      desc={v.desc}
                      active={variant === v.id}
                      onPress={() => {
                        trigger("selection");
                        setVariant(v.id);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={[styles.sectionSep, { backgroundColor: ui.panelBorderSoft }]} />

              {/* Play Style */}
              <View style={styles.section}>
                <SectionLabel label="PLAY STYLE" />
                <View style={styles.toggleRow}>
                  {PLAY_STYLE_OPTIONS.map((opt) => (
                    <ToggleBtn
                      key={opt.id}
                      label={opt.label}
                      desc={opt.desc}
                      active={playStyle === opt.id}
                      onPress={() => {
                        trigger("selection");
                        setPlayStyle(opt.id);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={[styles.sectionSep, { backgroundColor: ui.panelBorderSoft }]} />

              {/* Throw-in */}
              <View style={[styles.section, numPlayers <= 2 && styles.sectionLocked]}>
                <SectionLabel
                  label="THROW-IN"
                  badge={numPlayers <= 2 ? "3–6 players only" : undefined}
                />
                <View style={styles.toggleRow}>
                  {THROW_OPTIONS.map((t) => (
                    <ToggleBtn
                      key={t.id}
                      label={t.label}
                      desc={t.desc}
                      active={throwIn === t.id}
                      disabled={numPlayers <= 2}
                      onPress={() => {
                        trigger("selection");
                        setThrowIn(t.id);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={[styles.sectionSep, { backgroundColor: ui.panelBorderSoft }]} />

              {/* AI Difficulty */}
              <View style={styles.section}>
                <SectionLabel label="AI DIFFICULTY" />
                <View style={styles.diffRow}>
                  {DIFF_OPTIONS.map((d) => (
                    <DiffBtn
                      key={d.id}
                      label={d.label}
                      desc={d.desc}
                      pips={d.pips}
                      color={d.color}
                      activeBg={d.activeBg}
                      active={difficulty === d.id}
                      onPress={() => {
                        trigger("selection");
                        setDiff(d.id);
                      }}
                    />
                  ))}
                </View>
              </View>

            </View>

            {/* ── START GAME footer ── */}
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: Math.max(insets.bottom, spacing.md),
                  backgroundColor: ui.panelBg,
                  borderTopColor: ui.panelBorderSoft,
                },
              ]}
            >
              <MenuButton label="START GAME" variant="primary" onPress={handleStart} icon="▶" />
            </View>

          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label, badge }: { label: string; badge?: string }) {
  const ui = useUiTheme();
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={[styles.sectionLabelText, { color: ui.textFaint }]}>{label}</Text>
      {badge && (
        <View
          style={[
            styles.badgePill,
            { borderColor: ui.panelBorderSoft, backgroundColor: ui.accentSoft },
          ]}
        >
          <Text style={[styles.badgePillText, { color: ui.textFaint }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

function PlayerBtn({ count, hint, active, onPress }: {
  count: number; hint: string; active: boolean; onPress: () => void;
}) {
  const ui = useUiTheme();
  return (
    <Pressable
      style={[
        styles.playerBtn,
        {
          borderColor: ui.panelBorderSoft,
          backgroundColor: ui.panelBg,
        },
        active && {
          borderColor: ui.accent,
          backgroundColor: ui.accentSoft,
          shadowColor: ui.accent,
          shadowOpacity: 0.70,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.playerNum,
          { color: ui.textFaint },
          active && { color: ui.accent },
        ]}
      >
        {count}
      </Text>
      <Text
        style={[
          styles.playerHint,
          { color: ui.textFaint },
          active && { color: ui.accentMuted },
        ]}
      >
        {hint}
      </Text>
      {active && (
        <View style={[styles.playerActiveDot, { backgroundColor: ui.accent }]} />
      )}
    </Pressable>
  );
}

function ModeCard({ icon, label, tag, desc, active, onPress }: {
  icon: string; label: string; tag: string; desc: string;
  active: boolean; onPress: () => void;
}) {
  const ui = useUiTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={styles.modeCardOuter}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 14, stiffness: 380 }); }}
      onPressOut={() => { scale.value = withSpring(1.00, { damping: 14, stiffness: 300 }); }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.modeCard,
          {
            borderColor: ui.panelBorderSoft,
            backgroundColor: ui.panelBg,
          },
          active && {
            borderColor: ui.accent,
            backgroundColor: ui.accentSoft,
            shadowColor: ui.accent,
            shadowOpacity: 0.70,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 0 },
            elevation: 12,
          },
          aStyle,
        ]}
      >
        <View
          style={[
            styles.modeIconBadge,
            active && {
              backgroundColor: ui.accentSoft,
              borderColor: ui.panelBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.modeIcon,
              { color: ui.textMuted },
              active && { color: ui.accent },
            ]}
          >
            {icon}
          </Text>
        </View>

        <View style={styles.modeBody}>
          <View style={styles.modeNameRow}>
            <Text
              style={[
                styles.modeName,
                { color: ui.textPrimary },
                active && { color: ui.accent },
              ]}
            >
              {label}
            </Text>
            <View
              style={[
                styles.modeTagPill,
                active && {
                  backgroundColor: ui.accentSoft,
                  borderColor: ui.panelBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.modeTagText,
                  { color: ui.textFaint },
                  active && { color: ui.accent },
                ]}
              >
                {tag}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.modeDesc,
              { color: ui.textMuted },
              active && { color: ui.textPrimary },
            ]}
            numberOfLines={2}
          >
            {desc}
          </Text>
        </View>

        <View
          style={[
            styles.modeRadio,
            active && {
              borderColor: ui.accent,
              backgroundColor: ui.accent,
            },
          ]}
        >
          {active && (
            <Text style={[styles.modeCheckText, { color: ui.badgeText }]}>✓</Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ToggleBtn({ label, desc, active, disabled, onPress }: {
  label: string; desc: string; active: boolean; disabled?: boolean; onPress: () => void;
}) {
  const ui = useUiTheme();
  return (
    <Pressable
      style={[
        styles.toggleBtn,
        {
          borderColor: ui.panelBorderSoft,
          backgroundColor: ui.panelBg,
        },
        active && {
          borderColor: ui.accent,
          backgroundColor: ui.accentSoft,
          shadowColor: ui.accent,
          shadowOpacity: 0.70,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.toggleLabel,
          { color: ui.textMuted },
          active && { color: ui.accent },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.toggleDesc,
          { color: ui.textFaint },
          active && { color: ui.accentMuted },
        ]}
        numberOfLines={2}
      >
        {desc}
      </Text>
    </Pressable>
  );
}

function DiffBtn({ label, desc, pips, color, activeBg, active, onPress }: {
  label: string; desc: string; pips: number; color: string;
  activeBg: string; active: boolean; onPress: () => void;
}) {
  const ui = useUiTheme();
  return (
    <Pressable
      style={[
        styles.diffBtn,
        {
          borderColor: ui.panelBorderSoft,
          backgroundColor: ui.panelBg,
        },
        active && { borderColor: color, backgroundColor: activeBg },
      ]}
      onPress={onPress}
    >
      <View style={styles.pipRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.pip, { backgroundColor: i < pips ? color : ui.panelBorderSoft }]} />
        ))}
      </View>
      <Text style={[styles.diffLabel, { color: ui.textMuted }, active && { color }]}>{label}</Text>
      <Text style={[styles.diffDesc, { color: ui.textFaint }]}>{desc}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.title, letterSpacing: 2.5 },
  headerSub: { ...typography.caption, marginTop: 3, letterSpacing: 0.4 },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  sections: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  section: {},
  sectionLocked: { opacity: 0.36 },
  sectionSep: {
    height: 1,
    marginHorizontal: -spacing.lg,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionLabelText: {
    ...typography.label,
    letterSpacing: 1.5,
  },
  badgePill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgePillText: { ...typography.label, letterSpacing: 0.4 },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  playerRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  playerBtn: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
    height: 66,
    borderRadius: radius.panel,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 14,
    gap: 2,
  },
  playerNum: { fontSize: 30, fontWeight: "900", lineHeight: 34 },
  playerHint: { ...typography.label, letterSpacing: 0.4 },
  playerActiveDot: {
    position: "absolute",
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modePair: { gap: spacing.sm },
  modeCardOuter: { width: "100%" },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.panel,
    borderWidth: 1.5,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    minHeight: 66,
  },
  modeIconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.sm + 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  modeIcon: { fontSize: 22, lineHeight: 26 },
  modeBody: { flex: 1, gap: 3 },
  modeNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modeName: {
    ...typography.heading,
    fontWeight: "800",
  },
  modeTagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  modeTagText: { ...typography.micro, letterSpacing: 1.0 },
  modeDesc: {
    ...typography.caption,
    fontWeight: "500",
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  modeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeCheckText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 14,
  },
  toggleRow: { flexDirection: "row", gap: spacing.sm },
  toggleBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: radius.panel,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toggleLabel: { ...typography.body, fontWeight: "800", textAlign: "center" },
  toggleDesc: { ...typography.label, letterSpacing: 0.3, textAlign: "center" },
  diffRow: { flexDirection: "row", gap: spacing.sm },
  diffBtn: {
    flex: 1,
    height: 64,
    borderRadius: radius.panel,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pipRow: { flexDirection: "row", gap: 4 },
  pip: { width: 6, height: 6, borderRadius: 3 },
  diffLabel: { ...typography.caption, fontWeight: "800" },
  diffDesc: { ...typography.label, letterSpacing: 0.3 },
});
