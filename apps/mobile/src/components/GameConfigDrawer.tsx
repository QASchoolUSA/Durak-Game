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
import type { GameVariant, ThrowInScope } from "@durak/game-core";
import type { Difficulty } from "../game/store";
import { useGameStore } from "../game/store";
import { MenuButton } from "./MenuButton";
import { colors, radius, shadows, spacing, typography } from "../theme";

// ── Static config ─────────────────────────────────────────────────────────────

const PLAYER_OPTIONS = [
  { count: 2, hint: "1 vs 1"  },
  { count: 3, hint: "vs 2 AI" },
  { count: 4, hint: "vs 3 AI" },
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
  const difficulty  = useGameStore((s) => s.difficulty);
  const setPlayers  = useGameStore((s) => s.setNumPlayers);
  const setVariant  = useGameStore((s) => s.setVariant);
  const setThrowIn  = useGameStore((s) => s.setThrowInScope);
  const setDiff     = useGameStore((s) => s.setDifficulty);
  const startGame   = useGameStore((s) => s.startGame);

  const handleStart = useCallback(() => {
    setModalVisible(false); onClose(); startGame();
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
              colors={[colors.feltMid, colors.feltBottom]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            />
            {/* Thin gold accent line along the top edge */}
            <View style={styles.topAccent} />

            {/* ── Drag handle + header (visual cue for swipe) ── */}
            <View style={styles.topBar}>
              <View style={styles.handleWrap}>
                <View style={styles.handle} />
              </View>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>NEW GAME</Text>
                <Text style={styles.headerSub}>Swipe down to cancel</Text>
              </View>
            </View>

            <View style={styles.divider} />

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
                      onPress={() => setPlayers(p.count)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sectionSep} />

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
                      onPress={() => setVariant(v.id)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sectionSep} />

              {/* Throw-in */}
              <View style={[styles.section, numPlayers <= 2 && styles.sectionLocked]}>
                <SectionLabel
                  label="THROW-IN"
                  badge={numPlayers <= 2 ? "3–4 players only" : undefined}
                />
                <View style={styles.toggleRow}>
                  {THROW_OPTIONS.map((t) => (
                    <ToggleBtn
                      key={t.id}
                      label={t.label}
                      desc={t.desc}
                      active={throwIn === t.id}
                      disabled={numPlayers <= 2}
                      onPress={() => setThrowIn(t.id)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sectionSep} />

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
                      onPress={() => setDiff(d.id)}
                    />
                  ))}
                </View>
              </View>

            </View>

            {/* ── START GAME footer ── */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
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
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabelText}>{label}</Text>
      {badge && (
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

function PlayerBtn({ count, hint, active, onPress }: {
  count: number; hint: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={[styles.playerBtn, active && styles.playerBtnOn]} onPress={onPress}>
      <Text style={[styles.playerNum,  active && styles.playerNumOn]}>{count}</Text>
      <Text style={[styles.playerHint, active && styles.playerHintOn]}>{hint}</Text>
      {active && <View style={styles.playerActiveDot} />}
    </Pressable>
  );
}

function ModeCard({ icon, label, tag, desc, active, onPress }: {
  icon: string; label: string; tag: string; desc: string;
  active: boolean; onPress: () => void;
}) {
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
      <Animated.View style={[styles.modeCard, active && styles.modeCardOn, aStyle]}>

        {/* ── Icon badge ── */}
        <View style={[styles.modeIconBadge, active && styles.modeIconBadgeOn]}>
          <Text style={[styles.modeIcon, active && styles.modeIconOn]}>{icon}</Text>
        </View>

        {/* ── Name + description ── */}
        <View style={styles.modeBody}>
          <View style={styles.modeNameRow}>
            <Text style={[styles.modeName, active && styles.modeNameOn]}>{label}</Text>
            <View style={[styles.modeTagPill, active && styles.modeTagPillOn]}>
              <Text style={[styles.modeTagText, active && styles.modeTagTextOn]}>{tag}</Text>
            </View>
          </View>
          <Text style={[styles.modeDesc, active && styles.modeDescOn]} numberOfLines={2}>{desc}</Text>
        </View>

        {/* ── Selection indicator ── */}
        <View style={[styles.modeRadio, active && styles.modeRadioOn]}>
          {active && <Text style={styles.modeCheckText}>✓</Text>}
        </View>

      </Animated.View>
    </Pressable>
  );
}

function ToggleBtn({ label, desc, active, disabled, onPress }: {
  label: string; desc: string; active: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.toggleBtn, active && styles.toggleBtnOn]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.toggleLabel, active && styles.toggleLabelOn]}>{label}</Text>
      <Text style={[styles.toggleDesc,  active && styles.toggleDescOn]}>{desc}</Text>
    </Pressable>
  );
}

function DiffBtn({ label, desc, pips, color, activeBg, active, onPress }: {
  label: string; desc: string; pips: number; color: string;
  activeBg: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.diffBtn, active && { borderColor: color, backgroundColor: activeBg }]}
      onPress={onPress}
    >
      <View style={styles.pipRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.pip, { backgroundColor: i < pips ? color : "rgba(255,255,255,0.10)" }]} />
        ))}
      </View>
      <Text style={[styles.diffLabel, active && { color }]}>{label}</Text>
      <Text style={styles.diffDesc}>{desc}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const IDLE_BORDER  = "rgba(231,192,103,0.18)";
const IDLE_BG      = "rgba(9,46,31,0.65)";

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },

  // ── Backdrop ──────────────────────────────────────────────────────────────
  backdrop: { backgroundColor: "rgba(4,14,9,1)" },

  // ── Sheet ─────────────────────────────────────────────────────────────────
  sheet: {
    position:             "absolute",
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             "hidden",
    flexDirection:        "column",
  },
  topAccent: {
    position: "absolute", top: 0, left: 44, right: 44,
    height: 1, borderRadius: 1,
    backgroundColor: "rgba(231,192,103,0.38)",
  },

  // ── Handle + Header (swipeable top bar) ───────────────────────────────────
  topBar: {},
  handleWrap: { alignItems: "center", paddingTop: 14, paddingBottom: 8 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.20)" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xs,
    paddingBottom:     spacing.sm,
  },
  headerTitle: { ...typography.title, color: colors.gold, letterSpacing: 2.5 },
  headerSub:   { ...typography.caption, color: colors.textFaint, marginTop: 3, letterSpacing: 0.4 },
  divider: {
    height: 1,
    backgroundColor: "rgba(231,192,103,0.12)",
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },

  // ── Non-scrollable sections ────────────────────────────────────────────────
  sections: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
    paddingBottom:     spacing.xs,
    gap:               spacing.sm,
  },
  section:       {},
  sectionLocked: { opacity: 0.36 },
  // Full-bleed separator — negative horizontal margin cancels the sections padding
  sectionSep: {
    height:           1,
    marginHorizontal: -spacing.lg,
    backgroundColor:  "rgba(231,192,103,0.10)",
  },
  sectionLabelRow: {
    flexDirection: "row", alignItems: "center",
    gap: spacing.sm, marginBottom: spacing.xs,
  },
  sectionLabelText: {
    ...typography.label,
    color: colors.textFaint, letterSpacing: 1.5,
  },
  badgePill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgePillText: { ...typography.label, color: colors.textFaint, letterSpacing: 0.4 },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: "rgba(9,46,31,0.88)",
    borderTopWidth: 1,
    borderTopColor: "rgba(231,192,103,0.14)",
    paddingTop:    spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // ── Player buttons ─────────────────────────────────────────────────────────
  playerRow: { flexDirection: "row", gap: spacing.sm },
  playerBtn: {
    flex: 1, height: 66,
    borderRadius: radius.panel, borderWidth: 1.5,
    borderColor: IDLE_BORDER, backgroundColor: IDLE_BG,
    alignItems: "center", justifyContent: "center",
    paddingBottom: 14,
    gap: 2,
  },
  playerBtnOn: {
    borderColor: colors.gold,
    backgroundColor: "rgba(231,192,103,0.10)",
    ...shadows.goldGlow,
  },
  playerNum:       { fontSize: 30, fontWeight: "900", color: colors.textFaint, lineHeight: 34 },
  playerNumOn:     { color: colors.gold },
  playerHint:      { ...typography.label, color: colors.textFaint, letterSpacing: 0.4 },
  playerHintOn:    { color: colors.goldDim },
  playerActiveDot: {
    position: "absolute", bottom: 6,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.gold,
  },

  // ── Mode rows (full-width, stacked) ────────────────────────────────────────
  modePair: { gap: spacing.sm },

  modeCardOuter: { width: "100%" },
  modeCard: {
    flexDirection:   "row",
    alignItems:      "center",
    borderRadius:    radius.panel,
    borderWidth:     1.5,
    borderColor:     IDLE_BORDER,
    backgroundColor: IDLE_BG,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap:             spacing.md,
    minHeight:       66,
  },
  modeCardOn: {
    borderColor:     colors.gold,
    backgroundColor: "rgba(231,192,103,0.10)",
    ...shadows.goldGlow,
  },

  // Square icon badge on the left
  modeIconBadge: {
    width:           42,
    height:          42,
    borderRadius:    radius.sm + 4,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.10)",
  },
  modeIconBadgeOn: {
    backgroundColor: "rgba(231,192,103,0.16)",
    borderColor:     "rgba(231,192,103,0.40)",
  },
  modeIcon:   { fontSize: 22, lineHeight: 26, color: colors.textMuted },
  modeIconOn: { color: colors.gold },

  // Text column
  modeBody:    { flex: 1, gap: 3 },
  modeNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },

  // Mode name
  modeName: {
    ...typography.heading,
    color:      colors.textLight,
    fontWeight: "800",
  },
  modeNameOn: { color: colors.gold },

  // Tag pill (CLASSIC / TRANSFER)
  modeTagPill: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      radius.pill,
    backgroundColor:   "rgba(255,255,255,0.05)",
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.10)",
  },
  modeTagPillOn: {
    backgroundColor: "rgba(231,192,103,0.14)",
    borderColor:     "rgba(231,192,103,0.35)",
  },
  modeTagText:   { ...typography.micro, color: colors.textFaint, letterSpacing: 1.0 },
  modeTagTextOn: { color: colors.goldBright },

  // Short description
  modeDesc: {
    ...typography.caption,
    fontWeight:    "500",
    color:         colors.textMuted,
    lineHeight:    16,
    letterSpacing: 0.1,
  },
  modeDescOn: { color: colors.textLight },

  // Radio / check indicator on the right
  modeRadio: {
    width:        22,
    height:       22,
    borderRadius: 11,
    borderWidth:  1.5,
    borderColor:  "rgba(255,255,255,0.20)",
    alignItems:     "center",
    justifyContent: "center",
  },
  modeRadioOn: {
    borderColor:     colors.gold,
    backgroundColor: colors.gold,
  },
  modeCheckText: {
    color:      colors.feltBottom,
    fontSize:   12,
    fontWeight: "900",
    lineHeight: 14,
  },

  // ── Toggle buttons ──────────────────────────────────────────────────────────
  toggleRow: { flexDirection: "row", gap: spacing.sm },
  toggleBtn: {
    flex: 1, height: 50,
    borderRadius: radius.panel, borderWidth: 1.5,
    borderColor: IDLE_BORDER, backgroundColor: IDLE_BG,
    alignItems: "center", justifyContent: "center", gap: 3,
  },
  toggleBtnOn: {
    borderColor: colors.gold,
    backgroundColor: "rgba(231,192,103,0.10)",
    ...shadows.goldGlow,
  },
  toggleLabel:   { ...typography.body,  color: colors.textMuted, fontWeight: "800" },
  toggleLabelOn: { color: colors.gold },
  toggleDesc:    { ...typography.label, color: colors.textFaint, letterSpacing: 0.3 },
  toggleDescOn:  { color: colors.goldDim },

  // ── Difficulty buttons ──────────────────────────────────────────────────────
  diffRow: { flexDirection: "row", gap: spacing.sm },
  diffBtn: {
    flex: 1, height: 64,
    borderRadius: radius.panel, borderWidth: 1.5,
    borderColor: IDLE_BORDER, backgroundColor: IDLE_BG,
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  pipRow:    { flexDirection: "row", gap: 4 },
  pip:       { width: 6, height: 6, borderRadius: 3 },
  diffLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "800" },
  diffDesc:  { ...typography.label, color: colors.textFaint, letterSpacing: 0.3 },
});
