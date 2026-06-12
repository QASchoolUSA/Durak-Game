import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameStore } from "../game/store";
import { useInviteActions } from "../game/useInviteActions";
import { trigger } from "../feedback/haptics";
import { radius, spacing, typography } from "../theme";

/**
 * Mounted at the app root so a friend's game invite surfaces anywhere — even
 * mid-game. Backed by the reactive `incomingInvites` query, so it also covers
 * the case where the app was opened from a push notification.
 */
export function IncomingInviteBanner() {
  const ui = useUiTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const invites = useQuery(
    api.invites.incomingInvites,
    isAuthenticated ? {} : "skip",
  );
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const { acceptInvite, declineInvite } = useInviteActions();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const invite = useMemo(() => {
    if (!invites) return null;
    return (
      invites.find(
        (i) => !dismissed[i.inviteId] && i.roomId !== onlineRoomId,
      ) ?? null
    );
  }, [invites, dismissed, onlineRoomId]);

  if (!invite) return null;

  const onAccept = async () => {
    setBusy(true);
    try {
      await acceptInvite(invite.inviteId);
    } catch {
      trigger("error");
    } finally {
      setBusy(false);
    }
  };

  const onDecline = async () => {
    setDismissed((d) => ({ ...d, [invite.inviteId]: true }));
    try {
      await declineInvite(invite.inviteId);
    } catch {
      /* ignore */
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOut.duration(160)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + spacing.xs }]}
    >
      <View style={[styles.card, { backgroundColor: ui.panelBg, borderColor: ui.accent }]}>
        <View style={styles.text}>
          <Text style={[styles.title, { color: ui.accent }]}>GAME INVITE</Text>
          <Text style={[styles.body, { color: ui.textPrimary }]} numberOfLines={1}>
            {invite.fromDisplayName} (@{invite.fromHandle}) invited you to play
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={onDecline} hitSlop={8} style={styles.decline}>
            <Text style={[styles.declineText, { color: ui.textMuted }]}>✕</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={onAccept}
            style={[styles.join, { backgroundColor: ui.accent }, busy && styles.busy]}
          >
            <Text style={[styles.joinText, { color: ui.badgeText }]}>
              {busy ? "…" : "JOIN"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.panel,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  text: { flex: 1 },
  title: { ...typography.label },
  body: { ...typography.caption, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  decline: { paddingHorizontal: spacing.xs },
  declineText: { fontSize: 18, fontWeight: "700" },
  join: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  busy: { opacity: 0.6 },
  joinText: { ...typography.caption, fontWeight: "800" },
});
