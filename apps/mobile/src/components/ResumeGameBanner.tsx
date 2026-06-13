import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUiTheme } from "../theme/UiThemeContext";
import { useGameStore } from "../game/store";
import { saveRoomSession } from "../game/onlineSessionStorage";
import { trigger } from "../feedback/haptics";
import { radius, spacing, typography } from "../theme";

/**
 * Home-screen prompt to rejoin a game still in progress. Backed by the reactive
 * `myActiveRooms` query (server truth), so it appears even after local session
 * memory is gone — the core of the "rejoin after leaving/closing" feature.
 */
export function ResumeGameBanner() {
  const ui = useUiTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useConvexAuth();
  const screen = useGameStore((s) => s.screen);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);

  const rooms = useQuery(
    api.rooms.myActiveRooms,
    isAuthenticated && screen === "home" ? {} : "skip",
  );

  // Prefer a game that's actually mid-play (and your turn) over an idle lobby.
  const room = useMemo(() => {
    if (!rooms || rooms.length === 0) return null;
    const playing = rooms.filter((r) => r.status === "playing");
    const pool = playing.length > 0 ? playing : rooms;
    return (
      pool.find((r) => r.isYourTurn) ?? pool[0] ?? null
    );
  }, [rooms]);

  if (screen !== "home" || onlineRoomId || !room) return null;

  const opponents = room.opponents.filter(Boolean);
  const subtitle =
    opponents.length > 0 ? `with ${opponents.join(", ")}` : "Tap to rejoin";

  const onResume = () => {
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
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOut.duration(160)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + spacing.xs }]}
    >
      <Pressable
        onPress={onResume}
        style={[styles.card, { backgroundColor: ui.panelBg, borderColor: ui.accent }]}
      >
        <View style={styles.text}>
          <Text style={[styles.title, { color: ui.accent }]}>
            {room.isYourTurn ? "YOUR TURN — GAME IN PROGRESS" : "GAME IN PROGRESS"}
          </Text>
          <Text style={[styles.body, { color: ui.textPrimary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={[styles.resume, { backgroundColor: ui.accent }]}>
          <Text style={[styles.resumeText, { color: ui.badgeText }]}>RESUME</Text>
        </View>
      </Pressable>
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
  resume: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  resumeText: { ...typography.caption, fontWeight: "800" },
});
