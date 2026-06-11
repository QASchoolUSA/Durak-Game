import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useUiTheme } from "../theme/UiThemeContext";
import { trigger } from "../feedback/haptics";
import { colors, radius, spacing, typography } from "../theme";

export interface AddFriendSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Relation = "none" | "friends" | "incoming" | "outgoing";

const RELATION_LABEL: Record<Relation, string> = {
  none: "ADD",
  friends: "FRIENDS",
  incoming: "ACCEPT",
  outgoing: "REQUESTED",
};

export function AddFriendSheet({ visible, onClose }: AddFriendSheetProps) {
  const ui = useUiTheme();
  const { isAuthenticated } = useConvexAuth();
  const [text, setText] = useState("");
  const query = text.trim().toLowerCase();
  const results = useQuery(
    api.profiles.searchByHandle,
    isAuthenticated && query.length > 0 ? { query } : "skip",
  );
  const sendRequest = useMutation(api.friends.sendRequest);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const onAdd = async (userId: Id<"users">) => {
    setPending((p) => ({ ...p, [userId]: true }));
    try {
      await sendRequest({ toUserId: userId });
      trigger("confirm");
    } catch {
      trigger("error");
    } finally {
      setPending((p) => ({ ...p, [userId]: false }));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: ui.panelBg, borderColor: ui.panelBorder }]}>
          <Text style={[styles.title, { color: ui.accent }]}>ADD FRIEND</Text>
          <TextInput
            style={[styles.input, { color: ui.textPrimary, borderColor: ui.panelBorderSoft }]}
            value={text}
            onChangeText={setText}
            placeholder="Search by handle"
            placeholderTextColor={ui.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {query.length > 0 && results === undefined ? (
            <ActivityIndicator color={ui.accent} style={{ marginTop: spacing.md }} />
          ) : null}
          <FlatList
            data={results ?? []}
            keyExtractor={(item) => item.userId}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={
              query.length > 0 && results !== undefined ? (
                <Text style={[styles.empty, { color: ui.textMuted }]}>No players found.</Text>
              ) : null
            }
            renderItem={({ item }) => {
              const relation = item.relation as Relation;
              const busy = pending[item.userId];
              const actionable = relation === "none" || relation === "incoming";
              return (
                <View style={[styles.row, { borderBottomColor: ui.panelBorderSoft }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: ui.textPrimary }]}>{item.displayName}</Text>
                    <Text style={[styles.handle, { color: ui.textMuted }]}>@{item.handle}</Text>
                  </View>
                  <Pressable
                    disabled={!actionable || busy}
                    onPress={() => onAdd(item.userId)}
                    style={[
                      styles.action,
                      {
                        backgroundColor: actionable ? ui.accent : "transparent",
                        borderColor: ui.panelBorder,
                      },
                      (!actionable || busy) && styles.actionMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        { color: actionable ? ui.badgeText : ui.textMuted },
                      ]}
                    >
                      {busy ? "…" : RELATION_LABEL[relation]}
                    </Text>
                  </Pressable>
                </View>
              );
            }}
          />
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={[styles.closeText, { color: ui.textMuted }]}>CLOSE</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(4,14,9,0.76)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
    maxHeight: "80%",
    gap: spacing.sm,
  },
  title: { ...typography.title, letterSpacing: 2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  list: { marginTop: spacing.xs },
  empty: { ...typography.body, textAlign: "center", marginTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { ...typography.heading },
  handle: { ...typography.caption },
  action: {
    minWidth: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
  },
  actionMuted: { opacity: 0.6 },
  actionText: { ...typography.caption, fontWeight: "800" },
  close: { alignItems: "center", paddingVertical: spacing.sm },
  closeText: { ...typography.caption, letterSpacing: 1 },
});
