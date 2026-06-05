import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOutUp } from "react-native-reanimated";
import { useGameStore } from "../game/store";

export interface SeatReactionBurstProps {
  playerId: string;
}

function SeatReactionBurstComponent({ playerId }: SeatReactionBurstProps) {
  const humanId = useGameStore((s) => s.humanId);
  const remoteReaction = useGameStore((s) => s.remoteReaction);
  const localReaction = useGameStore((s) => s.localReaction);
  const tryConsumeReactionAt = useGameStore((s) => s.tryConsumeReactionAt);

  const [burst, setBurst] = useState<{ emoji: string; key: number } | null>(null);

  useEffect(() => {
    if (!localReaction || localReaction.fromPlayerId !== playerId) return;
    if (!tryConsumeReactionAt(localReaction.at)) return;
    setBurst({ emoji: localReaction.emoji, key: localReaction.at });
    const t = setTimeout(() => setBurst(null), 1200);
    return () => clearTimeout(t);
  }, [localReaction, playerId, tryConsumeReactionAt]);

  useEffect(() => {
    if (!remoteReaction || remoteReaction.fromPlayerId !== playerId) return;
    if (!tryConsumeReactionAt(remoteReaction.at)) return;
    if (remoteReaction.fromPlayerId === humanId) return;
    setBurst({ emoji: remoteReaction.emoji, key: remoteReaction.at });
    const t = setTimeout(() => setBurst(null), 1200);
    return () => clearTimeout(t);
  }, [remoteReaction, playerId, humanId, tryConsumeReactionAt]);

  useEffect(() => {
    if (!remoteReaction || remoteReaction.fromPlayerId !== humanId) return;
    if (remoteReaction.fromPlayerId !== playerId) return;
    tryConsumeReactionAt(remoteReaction.at);
  }, [remoteReaction, humanId, playerId, tryConsumeReactionAt]);

  if (!burst) return null;

  return (
    <Animated.Text
      key={burst.key}
      entering={FadeIn}
      exiting={FadeOutUp.duration(900)}
      style={styles.burst}
      pointerEvents="none"
    >
      {burst.emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    marginBottom: 6,
    fontSize: 36,
    textAlign: "center",
    zIndex: 30,
  },
});

export const SeatReactionBurst = React.memo(SeatReactionBurstComponent);
