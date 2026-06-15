import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  InputAccessoryView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FriendRow } from "./FriendRow";
import { HandleSetupSheet } from "./HandleSetupSheet";
import { radius, spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { useInviteActions } from "../game/useInviteActions";
import { useGameStore } from "../game/store";
import { saveRoomSession } from "../game/onlineSessionStorage";
import { trigger } from "../feedback/haptics";

// ── Animation springs (match GameConfigDrawer) ───────────────────────────────

const SPRING_IN  = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;
// Opens at the collapsed detent; pull up on the sheet to expand to full height.
const COLLAPSED_RATIO = 0.55;
/** iOS InputAccessoryView toolbar above the search keyboard */
const SEARCH_ACCESSORY_ID = "friendsSearchAccessory";

type Tab = "friends" | "requests" | "invites";

type Relation = "none" | "friends" | "incoming" | "outgoing";

const RELATION_LABEL: Record<Relation, string> = {
  none: "ADD",
  friends: "FRIENDS",
  incoming: "ACCEPT",
  outgoing: "REQUESTED",
};

export interface FriendsDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function FriendsDrawer({ visible, onClose }: FriendsDrawerProps) {
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
  // translateY of the collapsed detent (0 = fully expanded).
  const collapsedTy = Math.max(0, drawerH - Math.round(screenH * COLLAPSED_RATIO));

  const [modalVisible, setModalVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const prevVisible = useRef(false);

  const ty        = useSharedValue(drawerH);
  const backdropO = useSharedValue(0);
  // Keep layout values in shared values so they're reachable from the gesture worklet
  const drawerHSV = useSharedValue(drawerH);
  const collapsedTySV = useSharedValue(collapsedTy);
  const startTySV = useSharedValue(0);
  useEffect(() => { drawerHSV.value = drawerH; }, [drawerH, drawerHSV]);
  useEffect(() => { collapsedTySV.value = collapsedTy; }, [collapsedTy, collapsedTySV]);

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

  // Instant close (no exit animation) when an action navigates to the lobby —
  // the Modal would otherwise sit above the new screen.
  const closeForNavigation = useCallback(() => {
    setModalVisible(false);
    onClose();
  }, [onClose]);

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
    setExpanded(false);
    ty.value        = withSpring(collapsedTy, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO, collapsedTy]);

  const expandSheet = useCallback(() => {
    setExpanded(true);
    ty.value        = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
  }, [ty, backdropO]);

  // ── Drag gesture: collapsed ⇄ expanded detents + swipe-down dismiss ───────

  const sheetPan = Gesture.Pan()
    // Expanded: only downward strokes (the list scrolls on upward ones).
    // Collapsed: both directions, so pulling up expands the sheet.
    .activeOffsetY(expanded ? 10 : [-10, 10])
    .failOffsetX([-22, 22])
    .onStart(() => {
      startTySV.value = ty.value;
    })
    .onUpdate((e) => {
      const next = Math.min(
        drawerHSV.value,
        Math.max(0, startTySV.value + e.translationY),
      );
      ty.value = next;
      // Backdrop only fades once the sheet drops below the collapsed detent
      const cTy = collapsedTySV.value;
      const denom = Math.max(1, drawerHSV.value - cTy);
      const progress = Math.min(1, Math.max(0, (next - cTy) / denom));
      backdropO.value = BACKDROP_FULL * (1 - progress);
    })
    .onEnd((e) => {
      const cTy = collapsedTySV.value;
      const full = drawerHSV.value;
      let target: number;
      if (e.velocityY < -800) {
        target = 0;
      } else if (e.velocityY > 800) {
        // Fast flick down: expanded steps to collapsed, collapsed dismisses
        target = startTySV.value < cTy * 0.5 ? cTy : full;
      } else {
        const pos = ty.value;
        if (pos < cTy * 0.5) target = 0;
        else if (pos < cTy + (full - cTy) * 0.35) target = cTy;
        else target = full;
      }
      if (target === full) {
        ty.value = withSpring(full, SPRING_OUT, () => {
          runOnJS(setModalVisible)(false);
          runOnJS(onClose)();
        });
        backdropO.value = withTiming(0, { duration: 210 });
      } else {
        ty.value        = withSpring(target, SPRING_IN);
        backdropO.value = withTiming(BACKDROP_FULL, { duration: 200 });
        runOnJS(setExpanded)(target === 0);
      }
    });

  // ── Friends data ───────────────────────────────────────────────────────────

  const [tab, setTab] = useState<Tab>("friends");
  const [handleOpen, setHandleOpen] = useState(false);

  const { isAuthenticated } = useConvexAuth();
  const authArgs = isAuthenticated ? {} : "skip";
  const profile = useQuery(api.profiles.getMyProfile, authArgs);
  const friends = useQuery(api.friends.listFriends, authArgs) ?? [];
  const incoming = useQuery(api.friends.incomingRequests, authArgs) ?? [];
  const outgoing = useQuery(api.friends.outgoingRequests, authArgs) ?? [];
  const invites = useQuery(api.invites.incomingInvites, authArgs) ?? [];
  const resumable = useQuery(api.rooms.myActiveRooms, authArgs) ?? [];
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);

  const resumeGame = useCallback(
    (room: { roomId: string; code: string }) => {
      const displayName =
        useGameStore.getState().onlineDisplayName.trim() || "Player";
      void saveRoomSession({ roomId: room.roomId, displayName });
      trigger("gameStart");
      enterOnlineLobby({
        roomId: room.roomId,
        displayName,
        code: room.code,
        isHost: false,
      });
      closeForNavigation();
    },
    [enterOnlineLobby, closeForNavigation],
  );

  const acceptRequest = useMutation(api.friends.acceptRequest);
  const declineRequest = useMutation(api.friends.declineRequest);
  const cancelRequest = useMutation(api.friends.cancelRequest);
  const removeFriend = useMutation(api.friends.removeFriend);
  const { sendInvite, acceptInvite, declineInvite } = useInviteActions();

  // ── Inline add-friend search ───────────────────────────────────────────────

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const query = searchText.trim().toLowerCase();
  const searchResults = useQuery(
    api.profiles.searchByHandle,
    isAuthenticated && searchOpen && query.length > 0 ? { query } : "skip",
  );
  const sendRequest = useMutation(api.friends.sendRequest);
  const [pendingAdd, setPendingAdd] = useState<Record<string, boolean>>({});

  const toggleSearch = useCallback(() => {
    trigger("uiTap");
    setSearchOpen((open) => {
      if (open) {
        setSearchText("");
      } else {
        // The keyboard needs the room — search always runs fully expanded.
        expandSheet();
      }
      return !open;
    });
  }, [expandSheet]);

  const onAdd = async (userId: Id<"users">) => {
    setPendingAdd((p) => ({ ...p, [userId]: true }));
    try {
      await sendRequest({ toUserId: userId });
      trigger("confirm");
    } catch {
      trigger("error");
    } finally {
      setPendingAdd((p) => ({ ...p, [userId]: false }));
    }
  };

  // Prompt for a handle the first time someone with no profile opens the drawer.
  useEffect(() => {
    if (profile === null) setHandleOpen(true);
  }, [profile]);

  const requestsBadge = incoming.length;
  const invitesBadge = invites.length;

  const tabs: { key: Tab; label: string; badge: number }[] = [
    { key: "friends", label: "FRIENDS", badge: 0 },
    { key: "requests", label: "REQUESTS", badge: requestsBadge },
    { key: "invites", label: "INVITES", badge: invitesBadge },
  ];

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
        <GestureDetector gesture={sheetPan}>
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
                {searchOpen ? (
                  <Animated.View key="search-title" entering={FadeIn.duration(180)}>
                    <Text style={[styles.headerTitle, { color: ui.accent }]}>ADD FRIEND</Text>
                    <Text style={[styles.headerSub, { color: ui.textPrimary }]}>
                      Search players by their @handle
                    </Text>
                  </Animated.View>
                ) : (
                  <Animated.View key="friends-title" entering={FadeIn.duration(180)}>
                    <Text style={[styles.headerTitle, { color: ui.accent }]}>FRIENDS</Text>
                    <Text style={[styles.headerSub, { color: ui.textPrimary }]}>
                      {expanded
                        ? "Swipe down to close"
                        : "Pull up for more · swipe down to close"}
                    </Text>
                  </Animated.View>
                )}
                <Pressable onPress={toggleSearch} hitSlop={12}>
                  <Text style={[styles.addBtnText, { color: ui.accent }]}>
                    {searchOpen ? "✕ CLOSE" : "+ ADD"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

            {searchOpen ? (
              <Animated.View
                key="search-bar"
                entering={FadeInDown.duration(220)}
                exiting={FadeOut.duration(120)}
                style={styles.searchWrap}
              >
                <View
                  style={[
                    styles.inputRow,
                    { backgroundColor: ui.panelBg, borderColor: ui.panelBorder },
                  ]}
                >
                  <Text style={[styles.inputPrefix, { color: ui.accent }]}>@</Text>
                  <TextInput
                    style={[styles.input, { color: ui.textPrimary }]}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="handle"
                    placeholderTextColor={ui.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    inputAccessoryViewID={
                      Platform.OS === "ios" ? SEARCH_ACCESSORY_ID : undefined
                    }
                  />
                  {searchText.length > 0 ? (
                    <Pressable onPress={() => setSearchText("")} hitSlop={10}>
                      <Text style={[styles.clearBtn, { color: ui.textMuted }]}>✕</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Animated.View>
            ) : (
              <>
                {profile ? (
                  <Text style={[styles.myHandle, { color: ui.textMuted }]}>
                    You are{" "}
                    <Text style={{ color: ui.textPrimary, fontWeight: "800" }}>
                      @{profile.handle}
                    </Text>
                    {"  "}
                    <Text onPress={() => setHandleOpen(true)} style={{ color: ui.accent }}>
                      (edit)
                    </Text>
                  </Text>
                ) : null}

                <View style={styles.tabs}>
                  {tabs.map((t) => {
                    const active = tab === t.key;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => setTab(t.key)}
                        style={[
                          styles.tab,
                          { borderColor: active ? ui.accent : ui.panelBorderSoft },
                          active && { backgroundColor: ui.panelBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            { color: active ? ui.accent : ui.textMuted },
                          ]}
                        >
                          {t.label}
                          {t.badge > 0 ? ` (${t.badge})` : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <ScrollView
              style={styles.sectionsScroll}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingBottom: Math.max(insets.bottom, spacing.xl),
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              // Collapsed: upward drags expand the sheet instead of scrolling
              scrollEnabled={expanded}
            >
              {searchOpen ? (
                <>
                  {query.length === 0 ? (
                    <Animated.View entering={FadeIn.duration(200)}>
                      <Text style={[styles.searchHint, { color: ui.textFaint }]}>
                        Friends can invite each other straight into a game.
                      </Text>
                    </Animated.View>
                  ) : searchResults === undefined ? (
                    <ActivityIndicator color={ui.accent} style={{ marginTop: spacing.lg }} />
                  ) : searchResults.length === 0 ? (
                    <Text style={[styles.empty, { color: ui.textMuted }]}>
                      No players found for “{query}”.
                    </Text>
                  ) : (
                    searchResults.map((item, i) => {
                      const relation = item.relation as Relation;
                      const busy = pendingAdd[item.userId];
                      const actionable = relation === "none" || relation === "incoming";
                      return (
                        <Animated.View
                          key={item.userId}
                          entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(220)}
                          style={[
                            styles.resultRow,
                            { backgroundColor: ui.panelBg, borderColor: ui.panelBorderSoft },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.resultName, { color: ui.textPrimary }]}
                              numberOfLines={1}
                            >
                              {item.displayName}
                            </Text>
                            <Text
                              style={[styles.resultHandle, { color: ui.textMuted }]}
                              numberOfLines={1}
                            >
                              @{item.handle}
                            </Text>
                          </View>
                          <Pressable
                            disabled={!actionable || busy}
                            onPress={() => onAdd(item.userId)}
                            style={[
                              styles.resultAction,
                              {
                                backgroundColor: actionable ? ui.accent : "transparent",
                                borderColor: actionable ? "transparent" : ui.panelBorder,
                              },
                              (!actionable || busy) && styles.resultActionMuted,
                            ]}
                          >
                            <Text
                              style={[
                                styles.resultActionText,
                                { color: actionable ? ui.badgeText : ui.textMuted },
                              ]}
                            >
                              {busy ? "…" : RELATION_LABEL[relation]}
                            </Text>
                          </Pressable>
                        </Animated.View>
                      );
                    })
                  )}
                </>
              ) : (
                <>
                  {tab === "friends" &&
                    (friends.length === 0 ? (
                      <Empty
                        text="No friends yet. Tap + ADD to find players by handle."
                        color={ui.textMuted}
                      />
                    ) : (
                      friends.map((f) => (
                        <FriendRow
                          key={f.friendshipId}
                          displayName={f.displayName}
                          handle={f.handle}
                          actions={[
                            {
                              key: "invite",
                              label: "INVITE",
                              kind: "primary",
                              onPress: () =>
                                void sendInvite(f.userId)
                                  .then(closeForNavigation)
                                  .catch(() => trigger("error")),
                            },
                            {
                              key: "remove",
                              label: "REMOVE",
                              kind: "danger",
                              onPress: () => void removeFriend({ friendshipId: f.friendshipId }),
                            },
                          ]}
                        />
                      ))
                    ))}

                  {tab === "requests" && (
                    <>
                      {incoming.length === 0 && outgoing.length === 0 ? (
                        <Empty text="No pending requests." color={ui.textMuted} />
                      ) : null}
                      {incoming.length > 0 ? (
                        <Text style={[styles.section, { color: ui.textFaint }]}>INCOMING</Text>
                      ) : null}
                      {incoming.map((r) => (
                        <FriendRow
                          key={r.friendshipId}
                          displayName={r.displayName}
                          handle={r.handle}
                          actions={[
                            {
                              key: "accept",
                              label: "ACCEPT",
                              kind: "primary",
                              onPress: () => void acceptRequest({ friendshipId: r.friendshipId }),
                            },
                            {
                              key: "decline",
                              label: "DECLINE",
                              kind: "danger",
                              onPress: () => void declineRequest({ friendshipId: r.friendshipId }),
                            },
                          ]}
                        />
                      ))}
                      {outgoing.length > 0 ? (
                        <Text style={[styles.section, { color: ui.textFaint }]}>SENT</Text>
                      ) : null}
                      {outgoing.map((r) => (
                        <FriendRow
                          key={r.friendshipId}
                          displayName={r.displayName}
                          handle={r.handle}
                          subtitle={`@${r.handle} · pending`}
                          actions={[
                            {
                              key: "cancel",
                              label: "CANCEL",
                              kind: "danger",
                              onPress: () => void cancelRequest({ friendshipId: r.friendshipId }),
                            },
                          ]}
                        />
                      ))}
                    </>
                  )}

                  {tab === "invites" && resumable.length > 0 &&
                    resumable.map((room) => (
                      <FriendRow
                        key={room.roomId}
                        displayName={
                          room.opponents.filter(Boolean).join(", ") || "Game in progress"
                        }
                        handle="game"
                        subtitle={
                          room.isYourTurn
                            ? "Your turn — game in progress"
                            : "Game in progress"
                        }
                        actions={[
                          {
                            key: "resume",
                            label: "RESUME",
                            kind: "primary",
                            onPress: () => resumeGame(room),
                          },
                        ]}
                      />
                    ))}

                  {tab === "invites" &&
                    (invites.length === 0 && resumable.length === 0 ? (
                      <Empty text="No game invites right now." color={ui.textMuted} />
                    ) : invites.length === 0 ? null : (
                      invites.map((inv) => (
                        <FriendRow
                          key={inv.inviteId}
                          displayName={inv.fromDisplayName}
                          handle={inv.fromHandle}
                          subtitle={`@${inv.fromHandle} invited you`}
                          actions={[
                            {
                              key: "join",
                              label: "JOIN",
                              kind: "primary",
                              onPress: () =>
                                void acceptInvite(inv.inviteId)
                                  .then(closeForNavigation)
                                  .catch(() => trigger("error")),
                            },
                            {
                              key: "decline",
                              label: "DECLINE",
                              kind: "danger",
                              onPress: () => void declineInvite(inv.inviteId),
                            },
                          ]}
                        />
                      ))
                    ))}
                </>
              )}
            </ScrollView>
          </Animated.View>
        </GestureDetector>

        <HandleSetupSheet
          visible={handleOpen}
          initialHandle={profile?.handle}
          onClose={() => setHandleOpen(false)}
        />
      </GestureHandlerRootView>

      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={SEARCH_ACCESSORY_ID}>
          <View
            style={[
              styles.accessoryBar,
              {
                borderTopColor: ui.panelBorderSoft,
                backgroundColor: ui.panelBg,
              },
            ]}
          >
            <Pressable
              style={styles.accessoryDone}
              onPress={() => Keyboard.dismiss()}
              hitSlop={8}
            >
              <Text style={[styles.accessoryDoneText, { color: ui.accent }]}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </Modal>
  );
}

function Empty({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.empty, { color }]}>{text}</Text>;
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { ...typography.title, letterSpacing: 2.5 },
  headerSub: { ...typography.caption, marginTop: 3, letterSpacing: 0.4 },
  addBtnText: { ...typography.caption, fontWeight: "800", letterSpacing: 1 },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  myHandle: {
    ...typography.caption,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  tabText: { ...typography.caption, fontWeight: "800", letterSpacing: 0.5 },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.xs,
  },
  inputPrefix: { ...typography.heading, fontWeight: "800" },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  clearBtn: { fontSize: 14, fontWeight: "700", padding: spacing.xs },
  searchHint: {
    ...typography.caption,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  resultName: { ...typography.heading },
  resultHandle: { ...typography.caption, marginTop: 1 },
  resultAction: {
    minWidth: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
  },
  resultActionMuted: { opacity: 0.6 },
  resultActionText: { ...typography.caption, fontWeight: "800", letterSpacing: 0.5 },
  sectionsScroll: { flex: 1 },
  section: {
    ...typography.label,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.xl },
  accessoryBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  accessoryDone: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  accessoryDoneText: {
    ...typography.body,
    fontWeight: "700",
    fontSize: 17,
  },
});
