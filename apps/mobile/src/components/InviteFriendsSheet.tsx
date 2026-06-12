import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { trigger } from "../feedback/haptics";
import { radius, spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { MenuButton } from "./MenuButton";
import { FriendRow } from "./FriendRow";

const SHEET_BODY_HEIGHT = 380;
const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

export interface InviteFriendsSheetProps {
  visible: boolean;
  roomId: Id<"rooms">;
  seatIndex: number;
  onClose: () => void;
}

export function InviteFriendsSheet({
  visible,
  roomId,
  seatIndex,
  onClose,
}: InviteFriendsSheetProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const insets = useSafeAreaInsets();
  const lay = useGameLayout();
  const sheetBodyH = lay.s(SHEET_BODY_HEIGHT);
  const sheetH = sheetBodyH + insets.bottom;

  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    ui.feltEdge,
  ];

  const [modalVisible, setModalVisible] = useState(false);
  const [invitedStatus, setInvitedStatus] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});
  const prevVisible = useRef(visible);

  const friends = useQuery(api.friends.listFriends) ?? [];
  const inviteFriendToRoom = useMutation(api.invites.inviteFriendToRoom);

  const ty = useSharedValue(sheetH);
  const backdropO = useSharedValue(0);
  const sheetHSV = useSharedValue(sheetH);
  useEffect(() => {
    sheetHSV.value = sheetH;
  }, [sheetH, sheetHSV]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value = withSpring(sheetH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [sheetH, ty, backdropO],
  );

  const closeSheet = useCallback(() => {
    animateOut(() => {
      setModalVisible(false);
      onClose();
    });
  }, [animateOut, onClose]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setInvitedStatus({});
      ty.value = sheetH;
      backdropO.value = 0;
      setModalVisible(true);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, sheetH, modalVisible, ty, backdropO, animateOut]);

  const onModalShow = useCallback(() => {
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO]);

  const handleInvite = async (userId: string) => {
    setInvitedStatus((prev) => ({ ...prev, [userId]: "sending" }));
    trigger("uiTap");
    try {
      await inviteFriendToRoom({
        toUserId: userId as Id<"users">,
        roomId,
      });
      setInvitedStatus((prev) => ({ ...prev, [userId]: "sent" }));
      trigger("confirm");
    } catch (err) {
      setInvitedStatus((prev) => ({ ...prev, [userId]: "error" }));
      trigger("error");
    }
  };

  const swipeDown = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-22, 22])
    .onUpdate((e) => {
      const drag = Math.max(0, e.translationY);
      ty.value = drag;
      backdropO.value = Math.max(
        0,
        BACKDROP_FULL * (1 - drag / (sheetHSV.value * 0.55)),
      );
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 650) {
        ty.value = withSpring(sheetHSV.value, SPRING_OUT, () => {
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
  const aSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={onModalShow}
      onRequestClose={closeSheet}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetH,
              borderColor: ui.accentMuted,
            },
            aSheet,
          ]}
        >
          <LinearGradient
            colors={sheetGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          <GestureDetector gesture={swipeDown}>
            <View style={styles.handleZone}>
              <View style={[styles.handle, { backgroundColor: ui.accentMuted }]} />
            </View>
          </GestureDetector>

          <View style={styles.header}>
            <Text style={[styles.title, { color: ui.accent }]}>INVITE FRIENDS</Text>
            <Text style={[styles.subtitle, { color: ui.textPrimary }]}>
              Invite a friend to seat {seatIndex + 1}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: ui.panelBorderSoft }]} />

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {friends.length === 0 ? (
              <Text style={[styles.emptyText, { color: ui.textMuted }]}>
                No friends yet. Add friends on the Home Screen.
              </Text>
            ) : (
              friends.map((friend) => {
                const status = invitedStatus[friend.userId] ?? "idle";
                const labelMap = {
                  idle: "INVITE",
                  sending: "...",
                  sent: "SENT ✓",
                  error: "ERROR ✗",
                };
                return (
                  <FriendRow
                    key={friend.userId}
                    displayName={friend.displayName}
                    handle={friend.handle}
                    actions={[
                      {
                        key: "invite",
                        label: labelMap[status],
                        kind: status === "sent" ? "neutral" : status === "error" ? "danger" : "primary",
                        disabled: status !== "idle",
                        onPress: () => handleInvite(friend.userId),
                      },
                    ]}
                  />
                );
              })
            )}
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, lay.s(spacing.md)),
                borderTopColor: ui.panelBorderSoft,
              },
            ]}
          >
            <MenuButton
              label="CLOSE"
              variant="ghost"
              onPress={closeSheet}
            />
          </View>
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
    borderWidth: 1,
  },
  handleZone: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.body,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
});
