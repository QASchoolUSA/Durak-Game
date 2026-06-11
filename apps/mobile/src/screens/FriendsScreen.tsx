import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Background } from "../components/Background";
import { FriendRow } from "../components/FriendRow";
import { HandleSetupSheet } from "../components/HandleSetupSheet";
import { AddFriendSheet } from "../components/AddFriendSheet";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameLayout } from "../theme/useGameLayout";
import { useGameStore } from "../game/store";
import { useInviteActions } from "../game/useInviteActions";
import { trigger } from "../feedback/haptics";
import { spacing, typography } from "../theme";

type Tab = "friends" | "requests" | "invites";

export function FriendsScreen() {
  const ui = useUiTheme();
  const lay = useGameLayout();
  const openHome = useGameStore((s) => s.openHome);
  const [tab, setTab] = useState<Tab>("friends");
  const [addOpen, setAddOpen] = useState(false);
  const [handleOpen, setHandleOpen] = useState(false);

  const { isAuthenticated } = useConvexAuth();
  const authArgs = isAuthenticated ? {} : "skip";
  const profile = useQuery(api.profiles.getMyProfile, authArgs);
  const friends = useQuery(api.friends.listFriends, authArgs) ?? [];
  const incoming = useQuery(api.friends.incomingRequests, authArgs) ?? [];
  const outgoing = useQuery(api.friends.outgoingRequests, authArgs) ?? [];
  const invites = useQuery(api.invites.incomingInvites, authArgs) ?? [];

  const acceptRequest = useMutation(api.friends.acceptRequest);
  const declineRequest = useMutation(api.friends.declineRequest);
  const cancelRequest = useMutation(api.friends.cancelRequest);
  const removeFriend = useMutation(api.friends.removeFriend);
  const { sendInvite, acceptInvite, declineInvite } = useInviteActions();

  // Prompt for a handle the first time someone with no profile opens this screen.
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

  return (
    <Background variant="home">
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.header, { paddingHorizontal: lay.hPad }]}>
          <Pressable onPress={openHome} hitSlop={12} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: ui.textPrimary }]}>‹ BACK</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: ui.accent }]}>FRIENDS</Text>
          <Pressable onPress={() => setAddOpen(true)} hitSlop={12} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: ui.accent }]}>+ ADD</Text>
          </Pressable>
        </View>

        {profile ? (
          <Text style={[styles.myHandle, { color: ui.textMuted, paddingHorizontal: lay.hPad }]}>
            You are{" "}
            <Text style={{ color: ui.textPrimary, fontWeight: "800" }}>@{profile.handle}</Text>
            {"  "}
            <Text onPress={() => setHandleOpen(true)} style={{ color: ui.accent }}>
              (edit)
            </Text>
          </Text>
        ) : null}

        <View style={[styles.tabs, { paddingHorizontal: lay.hPad }]}>
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

        <ScrollView
          style={styles.list}
          contentContainerStyle={{ paddingHorizontal: lay.hPad, paddingBottom: spacing.xl }}
        >
          {tab === "friends" &&
            (friends.length === 0 ? (
              <Empty text="No friends yet. Tap + ADD to find players by handle." color={ui.textMuted} />
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
                      onPress: () => void sendInvite(f.userId).catch(() => trigger("error")),
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

          {tab === "invites" &&
            (invites.length === 0 ? (
              <Empty text="No game invites right now." color={ui.textMuted} />
            ) : (
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
                        void acceptInvite(inv.inviteId).catch(() => trigger("error")),
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
        </ScrollView>
      </SafeAreaView>

      <AddFriendSheet visible={addOpen} onClose={() => setAddOpen(false)} />
      <HandleSetupSheet
        visible={handleOpen}
        initialHandle={profile?.handle}
        onClose={() => setHandleOpen(false)}
      />
    </Background>
  );
}

function Empty({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.empty, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  headerBtn: { minWidth: 64 },
  headerBtnText: { ...typography.caption, fontWeight: "800", letterSpacing: 1 },
  headerTitle: { ...typography.title, letterSpacing: 3 },
  myHandle: { ...typography.caption, marginBottom: spacing.sm },
  tabs: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  tabText: { ...typography.caption, fontWeight: "800", letterSpacing: 0.5 },
  list: { flex: 1 },
  section: {
    ...typography.label,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.xl },
});
