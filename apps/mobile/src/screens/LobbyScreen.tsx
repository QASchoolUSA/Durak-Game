import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { Background } from "../components/Background";
import { MenuButton } from "../components/MenuButton";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { trigger } from "../feedback/haptics";
import { clearRoomSession } from "../game/onlineSessionStorage";
import { useGameStore } from "../game/store";
import { useUiTheme } from "../theme/UiThemeContext";
import { layoutFor, radius, spacing, typography } from "../theme";

export function LobbyScreen() {
  const ui = useUiTheme();
  const { width } = useWindowDimensions();
  const lay = layoutFor(width);

  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const onlineSessionToken = useGameStore((s) => s.onlineSessionToken);
  const onlineRoomCode = useGameStore((s) => s.onlineRoomCode);
  const onlineIsHost = useGameStore((s) => s.onlineIsHost);
  const numPlayers = useGameStore((s) => s.numPlayers);
  const onlineDisplayName = useGameStore((s) => s.onlineDisplayName);
  const goHome = useGameStore((s) => s.goHome);

  const startGame = useMutation(api.rooms.startGame);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const setReady = useMutation(api.rooms.setReady);

  const roomView = useQuery(
    api.rooms.getRoomView,
    onlineRoomId && onlineSessionToken
      ? {
          roomId: onlineRoomId as Id<"rooms">,
          sessionToken: onlineSessionToken,
        }
      : "skip",
  );

  const members = roomView?.members ?? [];
  const humanCount = roomView?.humanCount ?? 0;
  const readyCount = roomView?.readyCount ?? 0;
  const allHumansReady = roomView?.allHumansReady ?? false;
  const code = roomView?.code ?? onlineRoomCode ?? "------";

  const humanMembers = useMemo(
    () =>
      members
        .filter((m) => !m.isBot)
        .sort((a, b) => a.seatIndex - b.seatIndex),
    [members],
  );

  const isLocalReady = roomView?.yourIsReady ?? false;

  const handleToggleReady = useCallback(async () => {
    if (!onlineRoomId || !onlineSessionToken || humanCount < 2) return;
    trigger(isLocalReady ? "selection" : "confirm");
    try {
      await setReady({
        roomId: onlineRoomId as Id<"rooms">,
        sessionToken: onlineSessionToken,
        ready: !isLocalReady,
      });
    } catch {
      trigger("error");
    }
  }, [
    onlineRoomId,
    onlineSessionToken,
    humanCount,
    isLocalReady,
    setReady,
  ]);

  const handleShare = useCallback(async () => {
    if (!code || code === "------") return;
    try {
      await Share.share({
        message: `Join my Durak game! Room code: ${code}`,
      });
    } catch {
      /* cancelled */
    }
  }, [code]);

  const handleStart = useCallback(async () => {
    if (!onlineRoomId || !onlineSessionToken) return;
    trigger("gameStart");
    try {
      await startGame({
        roomId: onlineRoomId as Id<"rooms">,
        sessionToken: onlineSessionToken,
        soloWithAi: false,
      });
    } catch {
      trigger("error");
    }
  }, [onlineRoomId, onlineSessionToken, startGame]);

  const handlePlayWithAi = useCallback(async () => {
    if (!onlineRoomId || !onlineSessionToken) return;
    trigger("gameStart");
    try {
      await startGame({
        roomId: onlineRoomId as Id<"rooms">,
        sessionToken: onlineSessionToken,
        soloWithAi: true,
      });
    } catch {
      trigger("error");
    }
  }, [onlineRoomId, onlineSessionToken, startGame]);

  const handleLeave = useCallback(async () => {
    if (onlineRoomId && onlineSessionToken) {
      try {
        await leaveRoom({
          roomId: onlineRoomId as Id<"rooms">,
          sessionToken: onlineSessionToken,
        });
      } catch {
        /* ignore */
      }
    }
    await clearRoomSession();
    goHome();
  }, [onlineRoomId, onlineSessionToken, leaveRoom, goHome]);

  return (
    <Background variant="home">
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { paddingHorizontal: lay.hPad, maxWidth: lay.maxContent }]}>
          <Text style={[styles.title, { color: ui.accent }]}>GAME LOBBY</Text>
          <Text style={[styles.subtitle, { color: ui.textFaint }]}>
            Share the code with friends
          </Text>

          <Pressable
            style={[styles.codeCard, { borderColor: ui.accent, backgroundColor: ui.panelBg }]}
            onPress={handleShare}
          >
            <Text style={[styles.codeLabel, { color: ui.textFaint }]}>ROOM CODE</Text>
            <Text style={[styles.codeValue, { color: ui.accent }]}>{code}</Text>
            <Text style={[styles.codeHint, { color: ui.textFaint }]}>Tap to share</Text>
          </Pressable>

          <View style={[styles.playerList, { borderColor: ui.panelBorderSoft, backgroundColor: ui.panelBg }]}>
            <Text style={[styles.listTitle, { color: ui.textFaint }]}>
              PLAYERS ({humanCount}/{numPlayers})
            </Text>
            {!roomView ? (
              <ActivityIndicator color={ui.accent} style={{ marginTop: spacing.md }} />
            ) : (
              humanMembers.map((m) => {
                const isYou = m.displayName === onlineDisplayName;
                const ready = m.isReady === true;
                return (
                  <View
                    key={`${m.seatIndex}-${m.displayName}`}
                    style={[
                      styles.playerRow,
                      { borderBottomColor: ui.panelBorderSoft },
                      isYou && { backgroundColor: ui.accentSoft },
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: ui.accentSoft }]}>
                      <Text style={[styles.avatarText, { color: ui.accent }]}>
                        {m.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.playerName, { color: ui.textPrimary }]}>
                      {m.displayName}
                      {isYou ? " (you)" : ""}
                    </Text>
                    {humanCount >= 2 && (
                      <View
                        style={[
                          styles.readyBadge,
                          {
                            borderColor: ready ? ui.accent : ui.panelBorderSoft,
                            backgroundColor: ready ? ui.accentSoft : "transparent",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.readyBadgeText,
                            { color: ready ? ui.accent : ui.textFaint },
                          ]}
                        >
                          {ready ? "Ready" : "Not ready"}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
            {onlineIsHost && humanCount === 1 && (
              <Text style={[styles.aiHint, { color: ui.textFaint }]}>
                Share the code, or play with AI to fill the other seats
              </Text>
            )}
            {onlineIsHost && humanCount >= 2 && humanCount < numPlayers && (
              <Text style={[styles.aiHint, { color: ui.textFaint }]}>
                Empty seats will be filled with AI when you start
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            {onlineIsHost && humanCount === 1 ? (
              <>
                <View style={[styles.waitPill, { backgroundColor: ui.accentSoft, borderColor: ui.panelBorderSoft }]}>
                  <Text style={[styles.waitText, { color: ui.textFaint }]}>
                    Waiting for a friend to join…
                  </Text>
                </View>
                <MenuButton
                  label="PLAY WITH AI"
                  variant="secondary"
                  icon="🤖"
                  onPress={handlePlayWithAi}
                />
              </>
            ) : onlineIsHost ? (
              allHumansReady ? (
                <MenuButton
                  label="START GAME"
                  variant="primary"
                  icon="▶"
                  onPress={handleStart}
                />
              ) : (
                <View style={[styles.waitPill, { backgroundColor: ui.accentSoft, borderColor: ui.panelBorderSoft }]}>
                  <Text style={[styles.waitText, { color: ui.textFaint }]}>
                    Waiting for players to ready up ({readyCount}/{humanCount})
                  </Text>
                </View>
              )
            ) : (
              <View style={[styles.waitPill, { backgroundColor: ui.accentSoft, borderColor: ui.panelBorderSoft }]}>
                <Text style={[styles.waitText, { color: ui.textFaint }]}>
                  {allHumansReady
                    ? "Waiting for host to start…"
                    : `Ready up to play (${readyCount}/${humanCount})`}
                </Text>
              </View>
            )}
            {humanCount >= 2 && (
              <MenuButton
                label={isLocalReady ? "NOT READY" : "READY"}
                variant={isLocalReady ? "ghost" : "secondary"}
                icon={isLocalReady ? "✕" : "✓"}
                onPress={handleToggleReady}
              />
            )}
            <MenuButton label="LEAVE" variant="ghost" onPress={handleLeave} />
          </View>
        </View>
      </SafeAreaView>
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignSelf: "center",
    width: "100%",
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    fontSize: 32,
    textAlign: "center",
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.body,
    textAlign: "center",
    marginTop: -spacing.sm,
  },
  codeCard: {
    borderWidth: 1.5,
    borderRadius: radius.panel,
    paddingVertical: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  codeLabel: {
    ...typography.caption,
    letterSpacing: 1.5,
  },
  codeValue: {
    fontSize: 42,
    fontWeight: "700",
    letterSpacing: 8,
  },
  codeHint: {
    ...typography.caption,
  },
  playerList: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.md,
    flex: 1,
    maxHeight: 280,
  },
  listTitle: {
    ...typography.caption,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "700",
    fontSize: 16,
  },
  playerName: {
    ...typography.body,
    fontWeight: "600",
    flex: 1,
  },
  readyBadge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readyBadgeText: {
    ...typography.caption,
    fontWeight: "600",
  },
  aiHint: {
    ...typography.caption,
    marginTop: spacing.md,
    textAlign: "center",
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  waitPill: {
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  waitText: {
    ...typography.body,
  },
});
