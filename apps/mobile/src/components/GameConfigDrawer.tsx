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
import { useMutation } from "convex/react";
import type { GameVariant, PlayStyle, ThrowInScope } from "@durak/game-core";
import { api } from "../../convex/_generated/api";
import type { Difficulty, PlayMode } from "../game/store";
import { useGameStore } from "../game/store";
import { DifficultyPicker } from "./DifficultyPicker";
import { MenuButton } from "./MenuButton";
import { colors, radius, spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { sheetHorizontalFrame } from "../theme/gameLayout";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { trigger } from "../feedback/haptics";
import { chargeBuyIn } from "../game/chargeBuyIn";
import { convexEnabled } from "../game/convexClient";
import { saveRoomSession } from "../game/onlineSessionStorage";
import { useOnlineAuth } from "../game/useAuthBootstrap";
import { usePreferencesStore } from "../game/preferencesStore";
import { CoinIcon } from "./CoinIcon";

// ── Static config ─────────────────────────────────────────────────────────────

const PLAY_MODE_OPTIONS: { id: PlayMode; label: string; desc: string }[] = [
  { id: "solo", label: "Vs AI", desc: "Play locally against bots" },
  { id: "online", label: "With friends", desc: "Wait in lobby for a friend, or fill with AI" },
];

const PLAYER_OPTIONS = [
  { count: 2, hint: "1 vs 1"  },
  { count: 3, hint: "vs 2 AI" },
  { count: 4, hint: "vs 3 AI" },
  { count: 5, hint: "vs 4 AI" },
  { count: 6, hint: "vs 5 AI" },
];

const VARIANTS: { id: GameVariant; icon: string; label: string }[] = [
  { id: "podkidnoy", icon: "♠", label: "Podkidnoy" },
  { id: "perevodnoy", icon: "↻", label: "Perevodnoy" },
];

const THROW_OPTIONS: { id: ThrowInScope; label: string; desc: string }[] = [
  { id: "all",      label: "All",       desc: "Any attacker can add" },
  { id: "neighbor", label: "Neighbors", desc: "Adjacent only"        },
];

const PLAY_STYLE_OPTIONS: { id: PlayStyle; label: string; desc: string }[] = [
  { id: "standard",  label: "Standard",       desc: "Classic Durak — no special powers" },
  { id: "abilities", label: "With Abilities", desc: "Return, graveyard & reveal a card" },
];

const BUY_IN_OPTIONS = [100, 250, 500, 1000, 5000, 10000, 20000];

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
  const lay = useGameLayout();
  const drawerH = Math.min(
    Math.round(screenH * 0.96),
    screenH - insets.top - lay.s(spacing.xs),
  );

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createRoom = useMutation(api.rooms.createRoom);
  const spendCredits = useMutation(api.wallets.spendCredits);

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
  const playMode    = useGameStore((s) => s.playMode);
  const setPlayers  = useGameStore((s) => s.setNumPlayers);
  const setVariant  = useGameStore((s) => s.setVariant);
  const setThrowIn  = useGameStore((s) => s.setThrowInScope);
  const setPlayStyle = useGameStore((s) => s.setPlayStyle);
  const setDiff     = useGameStore((s) => s.setDifficulty);
  const setPlayMode = useGameStore((s) => s.setPlayMode);
  const startGame   = useGameStore((s) => s.startGame);
  const buyIn = useGameStore((s) => s.buyIn);
  const setBuyIn = useGameStore((s) => s.setBuyIn);
  const syncCreditBalance = useGameStore((s) => s.syncCreditBalance);
  const deductCreditsLocal = useGameStore((s) => s.deductCreditsLocal);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);
  const turnSeconds = usePreferencesStore((s) => s.turnSeconds);

  const convexConfigured = convexEnabled;
  const { authReady, authLoading, ensureAuthenticated } = useOnlineAuth();

  const handleStart = useCallback(async () => {
    if (playMode === "online" && !convexConfigured) {
      setCreateError("Online play is not configured on this build.");
      return;
    }
    if (playMode === "solo") {
      setCreateError(null);
      const charged = await chargeBuyIn({
        convexEnabled: convexConfigured,
        ensureAuthenticated,
        spendCredits,
        buyIn: playMode === "solo" ? 100 : buyIn,
        syncCreditBalance,
        deductCreditsLocal,
      });
      if (!charged) {
        setCreateError("Not enough credits.");
        return;
      }
      trigger("gameStart");
      setModalVisible(false);
      onClose();
      startGame(undefined, { buyInCharged: convexConfigured });
      return;
    }

    const name = useGameStore.getState().onlineDisplayName.trim() || "Host";
    setCreating(true);
    setCreateError(null);
    try {
      await ensureAuthenticated();
      const result = await createRoom({
        displayName: name,
        config: {
          numPlayers,
          variant,
          throwInScope: throwIn,
          playStyle,
          difficulty,
        },
        turnTimerSeconds: turnSeconds,
        buyIn,
      });
      await saveRoomSession({
        roomId: result.roomId,
        displayName: name,
      });
      trigger("gameStart");
      enterOnlineLobby({
        roomId: result.roomId,
        displayName: name,
        code: result.code,
        isHost: true,
      });
      setModalVisible(false);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create room";
      setCreateError(
        msg.toLowerCase().includes("not authenticated")
          ? "Could not sign in for online play. Check your connection and try again."
          : msg,
      );
      trigger("error");
    } finally {
      setCreating(false);
    }
  }, [
    playMode,
    convexConfigured,
    ensureAuthenticated,
    createRoom,
    spendCredits,
    buyIn,
    syncCreditBalance,
    deductCreditsLocal,
    numPlayers,
    variant,
    throwIn,
    playStyle,
    difficulty,
    onClose,
    startGame,
    enterOnlineLobby,
    turnSeconds,
  ]);

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
          <Animated.View style={[styles.sheet, { height: drawerH, ...sheetHorizontalFrame(lay) }, aSheet]}>

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
                <Text style={[styles.headerSub, { color: ui.textPrimary }]}>
                  Swipe down to cancel
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

            {/* ── Scrollable sections (footer pinned below) ── */}
            <ScrollView
              style={styles.sectionsScroll}
              contentContainerStyle={styles.sections}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              {/* Play mode */}
              <View style={styles.section}>
                <SectionLabel label="PLAY MODE" />
                <View style={styles.toggleRow}>
                  {PLAY_MODE_OPTIONS.map((opt) => (
                    <ToggleBtn
                      key={opt.id}
                      label={opt.label}
                      desc={opt.desc}
                      active={playMode === opt.id}
                      onPress={() => {
                        trigger("selection");
                        setPlayMode(opt.id);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={[styles.sectionSep, { backgroundColor: ui.panelBorderSoft }]} />

              {/* Players */}
              <View style={styles.section}>
                <SectionLabel
                  label="PLAYERS"
                  badge={playMode === "online" ? "Max seats" : undefined}
                />
                <PlayerCountStrip
                  value={numPlayers}
                  playMode={playMode}
                  onChange={(n) => {
                    trigger("selection");
                    setPlayers(n);
                  }}
                />
              </View>

              <View style={[styles.sectionSep, { backgroundColor: ui.panelBorderSoft }]} />

              {/* Buy in */}
              {playMode === "online" && (
                <>
                  <View style={styles.section}>
                    <SectionLabel label="BUY IN" />
                    <BuyInStrip
                      value={buyIn}
                      onChange={(val) => {
                        trigger("selection");
                        setBuyIn(val);
                      }}
                    />
                  </View>
                  <View style={[styles.sectionSep, { backgroundColor: ui.panelBorderSoft }]} />
                </>
              )}

              {/* Game Mode */}
              <View style={styles.section}>
                <SectionLabel label="GAME MODE" />
                <View style={styles.toggleRow}>
                  {VARIANTS.map((v) => (
                    <ToggleBtn
                      key={v.id}
                      icon={v.icon}
                      label={v.label}
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

              {playMode !== "online" && (
                <>
                  <View style={[styles.sectionSep, { backgroundColor: ui.panelBorderSoft }]} />

                  {/* AI Difficulty */}
                  <View style={styles.section}>
                    <SectionLabel label="AI DIFFICULTY" />
                    <DifficultyPicker
                      value={difficulty}
                      onChange={(d) => {
                        trigger("selection");
                        setDiff(d);
                      }}
                    />
                  </View>
                </>
              )}

            </ScrollView>

            {/* ── START GAME footer ── */}
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: Math.max(insets.bottom, lay.s(spacing.lg)),
                  backgroundColor: ui.panelBg,
                  borderTopColor: ui.panelBorderSoft,
                },
              ]}
            >
              {createError && (
                <Text style={[styles.createError, { color: colors.danger }]}>{createError}</Text>
              )}
              <MenuButton
                label={
                  playMode === "online"
                    ? creating
                      ? "CREATING…"
                      : authLoading && !authReady
                        ? "SIGNING IN…"
                        : "CREATE ROOM"
                    : "START GAME"
                }
                variant="primary"
                onPress={handleStart}
                icon="▶"
                disabled={
                  playMode === "online" &&
                  (creating || (authLoading && !authReady) || !convexConfigured)
                }
              />
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
      <Text style={[styles.sectionLabelText, { color: ui.textPrimary }]}>{label}</Text>
      {badge && (
        <View
          style={[
            styles.badgePill,
            { borderColor: ui.panelBorderSoft, backgroundColor: ui.accentSoft },
          ]}
        >
          <Text style={[styles.badgePillText, { color: ui.textPrimary }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

function playerCountHint(count: number, playMode: PlayMode): string {
  if (playMode === "online") {
    return `${count} seats at the table · manage AI in the lobby`;
  }
  return PLAYER_OPTIONS.find((p) => p.count === count)?.hint ?? "";
}

function PlayerCountStrip({
  value,
  playMode,
  onChange,
}: {
  value: number;
  playMode: PlayMode;
  onChange: (n: number) => void;
}) {
  const ui = useUiTheme();
  return (
    <View>
      <View style={styles.playerStripRow}>
        {PLAYER_OPTIONS.map((p) => {
          const active = value === p.count;
          return (
            <Pressable
              key={p.count}
              style={[
                styles.playerChip,
                {
                  borderColor: ui.panelBorderSoft,
                  backgroundColor: ui.panelBg,
                },
                active && {
                  borderColor: ui.accent,
                  backgroundColor: ui.accentSoft,
                },
              ]}
              onPress={() => onChange(p.count)}
            >
              <Text
                style={[
                  styles.playerChipNum,
                  { color: ui.textPrimary },
                  active && { color: ui.accent },
                ]}
              >
                {p.count}
              </Text>
              {active && (
                <View style={[styles.playerChipDot, { backgroundColor: ui.accent }]} />
              )}
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.playerHintLine, { color: ui.textMuted }]}>
        {playerCountHint(value, playMode)}
      </Text>
    </View>
  );
}

function BuyInStrip({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const ui = useUiTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.buyInScrollContainer}
    >
      {BUY_IN_OPTIONS.map((opt) => {
        const active = value === opt;
        const label = opt >= 1000 ? `${opt / 1000}K` : `${opt}`;
        return (
          <Pressable
            key={opt}
            style={[
              styles.buyInChip,
              {
                borderColor: ui.panelBorderSoft,
                backgroundColor: ui.panelBg,
              },
              active && {
                borderColor: ui.accent,
                backgroundColor: ui.accentSoft,
              },
            ]}
            onPress={() => onChange(opt)}
          >
            <CoinIcon variant="credit" size={14} />
            <Text
              style={[
                styles.buyInChipText,
                { color: ui.textPrimary },
                active && { color: ui.accent },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ToggleBtn({ icon, label, desc, active, disabled, onPress }: {
  icon?: string; label: string; desc?: string; active: boolean; disabled?: boolean; onPress: () => void;
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
      {icon ? (
        <Text
          style={[
            styles.toggleIcon,
            { color: ui.textMuted },
            active && { color: ui.accent },
          ]}
        >
          {icon}
        </Text>
      ) : null}
      <Text
        style={[
          styles.toggleLabel,
          { color: ui.textPrimary },
          active && { color: ui.accent },
        ]}
      >
        {label}
      </Text>
      {desc ? (
        <Text
          style={[
            styles.toggleDesc,
            { color: ui.textMuted },
            active && { color: ui.textPrimary },
          ]}
          numberOfLines={2}
        >
          {desc}
        </Text>
      ) : null}
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
  sectionsScroll: {
    flex: 1,
  },
  sections: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
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
    marginBottom: 2,
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
  playerStripRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  playerChip: {
    flex: 1,
    height: 44,
    borderRadius: radius.panel,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  playerChipNum: {
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 24,
  },
  playerChipDot: {
    position: "absolute",
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  playerHintLine: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  toggleRow: { flexDirection: "row", gap: spacing.sm },
  toggleBtn: {
    flex: 1,
    minHeight: 66,
    borderRadius: radius.panel,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.heading, fontWeight: "800", textAlign: "center" },
  toggleIcon: { fontSize: 22, lineHeight: 26 },
  toggleDesc: { ...typography.caption, fontWeight: "500", textAlign: "center", lineHeight: 16, letterSpacing: 0.1 },
  nameInput: {
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  createError: {
    ...typography.caption,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  buyInScrollContainer: {
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  buyInChip: {
    height: 40,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: radius.panel,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  buyInChipText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
