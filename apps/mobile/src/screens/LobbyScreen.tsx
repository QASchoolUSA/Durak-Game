import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { AddAiSeatSheet } from "../components/AddAiSeatSheet";
import { Background } from "../components/Background";
import { MenuButton } from "../components/MenuButton";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { trigger } from "../feedback/haptics";
import { clearRoomSession } from "../game/onlineSessionStorage";
import type { Difficulty } from "../game/store";
import { useGameStore } from "../game/store";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, spacing, typography } from "../theme";
import { useGameLayout } from "../theme/useGameLayout";
import { InviteFriendsSheet } from "../components/InviteFriendsSheet";
import { useAccountKind } from "../game/useAccountKind";
import { useTranslation } from "react-i18next";

type RoomMemberView = {
  displayName: string;
  seatIndex: number;
  isBot: boolean;
  isReady?: boolean;
  isSelf?: boolean;
};

export function LobbyScreen() {
  const { t } = useTranslation();
  const ui = useUiTheme();
  const lay = useGameLayout();

  const { isAuthenticated } = useConvexAuth();
  const { isGuest } = useAccountKind();
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const onlineRoomCode = useGameStore((s) => s.onlineRoomCode);
  const onlineIsHost = useGameStore((s) => s.onlineIsHost);
  const goHome = useGameStore((s) => s.goHome);

  const [addAiSeat, setAddAiSeat] = useState<number | null>(null);
  const [inviteFriendsSeat, setInviteFriendsSeat] = useState<number | null>(null);

  const canInviteFriends = onlineIsHost && !isGuest;

  const startGame = useMutation(api.rooms.startGame);
  const leaveRoom = useMutation(api.rooms.leaveRoom);
  const setReady = useMutation(api.rooms.setReady);
  const setLobbyBot = useMutation(api.rooms.setLobbyBot);
  const setRoomDifficulty = useMutation(api.rooms.setRoomDifficulty);

  const roomView = useQuery(
    api.rooms.getRoomView,
    onlineRoomId && isAuthenticated
      ? { roomId: onlineRoomId as Id<"rooms"> }
      : "skip",
  );

  const members = roomView?.members ?? [];
  const humanCount = roomView?.humanCount ?? 0;
  const readyCount = roomView?.readyCount ?? 0;
  const allHumansReady = roomView?.allHumansReady ?? false;
  const code = roomView?.code ?? onlineRoomCode ?? "------";
  const maxSeats = roomView?.config.numPlayers ?? 2;
  const roomDifficulty = roomView?.config.difficulty ?? "medium";
  const roomPlayStyle = roomView?.config.playStyle ?? "standard";
  const playStyleLabel =
    roomPlayStyle === "abilities" ? t("lobby.playStyle.abilities") : t("lobby.playStyle.standard");
  const joinedCount = members.length;

  const seats = useMemo(() => {
    const slots: { seatIndex: number; member?: RoomMemberView }[] = [];
    for (let i = 0; i < maxSeats; i++) {
      slots.push({
        seatIndex: i,
        member: members.find((m) => m.seatIndex === i),
      });
    }
    return slots;
  }, [members, maxSeats]);

  const hasEmptySeat = seats.some((s) => !s.member);

  const canHostStart =
    onlineIsHost &&
    ((joinedCount >= 2 && humanCount < 2) ||
      (humanCount >= 2 && allHumansReady));

  const showStartCompact =
    canHostStart && humanCount < maxSeats && hasEmptySeat;

  const isLocalReady = roomView?.yourIsReady ?? false;

  const handleToggleReady = useCallback(async () => {
    if (!onlineRoomId || !isAuthenticated || humanCount < 2) return;
    trigger(isLocalReady ? "selection" : "confirm");
    try {
      await setReady({
        roomId: onlineRoomId as Id<"rooms">,
        ready: !isLocalReady,
      });
    } catch {
      trigger("error");
    }
  }, [
    onlineRoomId,
    isAuthenticated,
    humanCount,
    isLocalReady,
    setReady,
  ]);

  const handleShare = useCallback(async () => {
    if (!code || code === "------") return;
    try {
      await Share.share({
        message: t("lobby.shareMessage", { code }),
      });
    } catch {
      /* cancelled */
    }
  }, [code, t]);

  const handleStart = useCallback(async () => {
    if (!onlineRoomId || !isAuthenticated) return;
    try {
      await startGame({
        roomId: onlineRoomId as Id<"rooms">,
        soloWithAi: false,
        autoFillEmptySeats: true,
      });
    } catch {
      trigger("error");
    }
  }, [onlineRoomId, isAuthenticated, startGame]);

  const handleStartCompact = useCallback(async () => {
    if (!onlineRoomId || !isAuthenticated) return;
    try {
      await startGame({
        roomId: onlineRoomId as Id<"rooms">,
        soloWithAi: false,
        autoFillEmptySeats: false,
      });
    } catch {
      trigger("error");
    }
  }, [onlineRoomId, isAuthenticated, startGame]);

  const handleLobbyBot = useCallback(
    async (seatIndex: number, enabled: boolean) => {
      if (!onlineRoomId || !isAuthenticated) return;
      trigger("selection");
      try {
        await setLobbyBot({
          roomId: onlineRoomId as Id<"rooms">,
          seatIndex,
          enabled,
        });
      } catch {
        trigger("error");
      }
    },
    [onlineRoomId, isAuthenticated, setLobbyBot],
  );

  const handleConfirmAddAi = useCallback(
    async (difficulty: Difficulty) => {
      if (!onlineRoomId || !isAuthenticated || addAiSeat === null) {
        throw new Error("Missing room");
      }
      if (difficulty !== roomDifficulty) {
        await setRoomDifficulty({
          roomId: onlineRoomId as Id<"rooms">,
          difficulty,
        });
      }
      await setLobbyBot({
        roomId: onlineRoomId as Id<"rooms">,
        seatIndex: addAiSeat,
        enabled: true,
      });
    },
    [
      onlineRoomId,
      isAuthenticated,
      addAiSeat,
      roomDifficulty,
      setRoomDifficulty,
      setLobbyBot,
    ],
  );

  const handleLeave = useCallback(async () => {
    if (onlineRoomId && isAuthenticated) {
      try {
        await leaveRoom({
          roomId: onlineRoomId as Id<"rooms">,
        });
      } catch {
        /* ignore */
      }
    }
    await clearRoomSession();
    goHome();
  }, [onlineRoomId, isAuthenticated, leaveRoom, goHome]);

  return (
    <Background variant="home">
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { paddingHorizontal: lay.hPad, maxWidth: lay.maxContent }]}>
          <Text style={[styles.title, { color: ui.accent }]}>{t("lobby.title")}</Text>
          <Text style={[styles.subtitle, { color: ui.textPrimary }]}>
            {t("lobby.subtitle", { playStyle: playStyleLabel })}
          </Text>

          <Pressable
            style={[styles.codeCard, { borderColor: ui.accent, backgroundColor: ui.panelBg }]}
            onPress={handleShare}
          >
            <Text style={[styles.codeLabel, { color: ui.textMuted }]}>{t("lobby.roomCode")}</Text>
            <Text style={[styles.codeValue, { color: ui.accent }]}>{code}</Text>
            <Text style={[styles.codeHint, { color: ui.textMuted }]}>{t("lobby.tapToShare")}</Text>
          </Pressable>

          <View
            style={[
              styles.playerList,
              { borderColor: ui.panelBorderSoft, backgroundColor: ui.panelBg },
            ]}
          >
            <Text style={[styles.listTitle, { color: ui.textMuted }]}>
              {t("lobby.seats", { joined: joinedCount, max: maxSeats })}
            </Text>
            {!roomView ? (
              <ActivityIndicator color={ui.accent} style={{ marginTop: spacing.md }} />
            ) : (
              <ScrollView
                style={styles.seatScroll}
                contentContainerStyle={styles.seatScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {seats.map(({ seatIndex, member }) => (
                  <SeatRow
                    key={seatIndex}
                    seatIndex={seatIndex}
                    member={member}
                    isYou={member?.isSelf === true}
                    showReady={humanCount >= 2 && member != null && !member.isBot}
                    canManageBots={onlineIsHost}
                    canInviteFriends={canInviteFriends}
                    onAddBot={() => setAddAiSeat(seatIndex)}
                    onRemoveBot={() => handleLobbyBot(seatIndex, false)}
                    onInviteFriend={() => setInviteFriendsSeat(seatIndex)}
                  />
                ))}
                {onlineIsHost && humanCount === 1 && (
                  <Text style={[styles.aiHint, { color: ui.textPrimary }]}>
                    {t("lobby.hint.emptySeatsFriends")}
                  </Text>
                )}
                {onlineIsHost && humanCount >= 2 && hasEmptySeat && (
                  <Text style={[styles.aiHint, { color: ui.textPrimary }]}>
                    {t("lobby.hint.emptySeatsStart")}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>

          <View style={styles.actions}>
            {onlineIsHost ? (
              canHostStart ? (
                <>
                  <MenuButton
                    label={t("lobby.startGame")}
                    variant="primary"
                    icon="▶"
                    onPress={handleStart}
                  />
                  {showStartCompact && (
                    <MenuButton
                      label={t("lobby.startWithN", { n: joinedCount })}
                      variant="secondary"
                      icon="▶"
                      onPress={handleStartCompact}
                    />
                  )}
                </>
              ) : (
                <View style={[styles.waitPill, { backgroundColor: ui.accentSoft, borderColor: ui.panelBorderSoft }]}>
                  <Text style={[styles.waitText, { color: ui.textPrimary }]}>
                    {joinedCount < 2
                      ? t("lobby.hint.addOrShare")
                      : t("lobby.hint.waitingReady", { ready: readyCount, human: humanCount })}
                  </Text>
                </View>
              )
            ) : (
              <View style={[styles.waitPill, { backgroundColor: ui.accentSoft, borderColor: ui.panelBorderSoft }]}>
                  <Text style={[styles.waitText, { color: ui.textPrimary }]}>
                    {allHumansReady
                      ? t("lobby.hint.waitingHost")
                      : t("lobby.hint.readyUp", { ready: readyCount, human: humanCount })}
                  </Text>
              </View>
            )}
            {humanCount >= 2 && (
              <MenuButton
                label={isLocalReady ? t("lobby.notReadyCta") : t("lobby.readyCta")}
                variant={isLocalReady ? "ghost" : "secondary"}
                icon={isLocalReady ? "✕" : "✓"}
                onPress={handleToggleReady}
              />
            )}
            <MenuButton label={t("lobby.leave")} variant="ghost" onPress={handleLeave} />
          </View>
        </View>
      </SafeAreaView>

      <AddAiSeatSheet
        visible={addAiSeat !== null}
        seatIndex={addAiSeat ?? 0}
        initialDifficulty={roomDifficulty}
        onClose={() => setAddAiSeat(null)}
        onConfirm={handleConfirmAddAi}
      />

      {onlineRoomId && canInviteFriends && (
        <InviteFriendsSheet
          visible={inviteFriendsSeat !== null}
          roomId={onlineRoomId as Id<"rooms">}
          seatIndex={inviteFriendsSeat ?? 0}
          onClose={() => setInviteFriendsSeat(null)}
        />
      )}
    </Background>
  );
}

function SeatRow({
  seatIndex,
  member,
  isYou,
  showReady,
  canManageBots,
  canInviteFriends,
  onAddBot,
  onRemoveBot,
  onInviteFriend,
}: {
  seatIndex: number;
  member?: RoomMemberView;
  isYou: boolean;
  showReady: boolean;
  canManageBots: boolean;
  canInviteFriends: boolean;
  onAddBot: () => void;
  onRemoveBot: () => void;
  onInviteFriend: () => void;
}) {
  const { t } = useTranslation();
  const ui = useUiTheme();

  if (!member) {
    return (
      <View
        style={[
          styles.playerRow,
          {
            borderColor: ui.panelBorderSoft,
            borderStyle: "dashed",
            backgroundColor: "rgba(255, 255, 255, 0.01)",
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: ui.panelBorderSoft }]}>
          <Text style={[styles.avatarText, { color: ui.textMuted }]}>—</Text>
        </View>
        <Text style={[styles.playerName, { color: ui.textMuted }]}>
          {t("lobby.seatEmpty", { n: seatIndex + 1 })}
        </Text>
        <View style={styles.seatActionsRow}>
          {canManageBots && (
            <Pressable
              style={[styles.seatAction, { borderColor: ui.accent, backgroundColor: ui.accentSoft }]}
              onPress={onAddBot}
            >
              <Text style={[styles.seatActionText, { color: ui.accent }]}>{t("lobby.addAi")}</Text>
            </Pressable>
          )}
          {canInviteFriends && (
            <Pressable
              style={[styles.seatAction, { borderColor: ui.accent, backgroundColor: ui.accentSoft }]}
              onPress={onInviteFriend}
            >
              <Text style={[styles.seatActionText, { color: ui.accent }]}>{t("lobby.addInvite")}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (member.isBot) {
    return (
      <View
        style={[
          styles.playerRow,
          {
            borderColor: ui.panelBorderSoft,
            backgroundColor: "rgba(255, 255, 255, 0.03)",
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: ui.accentSoft }]}>
          <Text style={[styles.avatarText, { color: ui.accent }]}>🤖</Text>
        </View>
        <Text style={[styles.playerName, { color: ui.textPrimary }]}>
          {member.displayName}
          <Text style={{ color: ui.textMuted }}> {t("common.ai")}</Text>
        </Text>
        {canManageBots && (
          <Pressable
            style={[styles.seatAction, { borderColor: ui.panelBorderSoft }]}
            onPress={onRemoveBot}
          >
            <Text style={[styles.seatActionText, { color: ui.textMuted }]}>
              {t("lobby.remove")}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  const ready = member.isReady === true;

  return (
    <View
      style={[
        styles.playerRow,
        {
          borderColor: isYou ? ui.accent : ui.panelBorderSoft,
          backgroundColor: isYou ? ui.accentSoft : "rgba(255, 255, 255, 0.03)",
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: ui.accentSoft }]}>
        <Text style={[styles.avatarText, { color: ui.accent }]}>
          {member.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.playerName, { color: ui.textPrimary }]}>
        {member.displayName}
        {isYou ? ` ${t("common.you")}` : ""}
      </Text>
      {showReady && (
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
              { color: ready ? ui.accent : ui.textMuted },
            ]}
          >
            {ready ? t("lobby.ready") : t("lobby.notReady")}
          </Text>
        </View>
      )}
    </View>
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
    minHeight: 0,
  },
  listTitle: {
    ...typography.caption,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  seatScroll: {
    flex: 1,
  },
  seatScrollContent: {
    paddingBottom: spacing.xs,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
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
  seatAction: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seatActionText: {
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
  seatActionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
});
