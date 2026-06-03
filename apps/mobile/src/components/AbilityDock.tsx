import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGameStore } from "../game/store";
import { DOCK_ROW_HEIGHT, dockPillStyles } from "./dockPill";
import { spacing } from "../theme";

function ReturnPill() {
  const returnSnapshot = useGameStore((s) => s.returnSnapshot);
  const returnExpiresAt = useGameStore((s) => s.returnExpiresAt);
  const returnLastCard = useGameStore((s) => s.returnLastCard);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!returnSnapshot || !returnExpiresAt) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      setRemaining(Math.max(0, (returnExpiresAt - Date.now()) / 1000));
    };

    tick();
    const iv = setInterval(tick, 50);
    return () => clearInterval(iv);
  }, [returnSnapshot, returnExpiresAt]);

  if (!returnSnapshot || remaining <= 0) {
    return null;
  }

  return (
    <Pressable
      style={[dockPillStyles.pill, dockPillStyles.pillUrgent]}
      onPress={returnLastCard}
      accessibilityRole="button"
      accessibilityLabel={`Return card, ${Math.ceil(remaining)} seconds left`}
    >
      <Text style={dockPillStyles.icon}>↩</Text>
      <Text style={dockPillStyles.label}>Return</Text>
      <Text style={dockPillStyles.countdown}>{Math.ceil(remaining)}</Text>
    </Pressable>
  );
}

function RevealPill({
  canReveal,
  onPress,
}: {
  canReveal: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[dockPillStyles.pill, !canReveal && dockPillStyles.pillDisabled]}
      onPress={onPress}
      disabled={!canReveal}
      accessibilityRole="button"
      accessibilityLabel={
        canReveal ? "Reveal an opponent card" : "Reveal unavailable"
      }
      accessibilityState={{ disabled: !canReveal }}
    >
      <Text style={dockPillStyles.icon}>👁</Text>
      <Text style={[dockPillStyles.label, !canReveal && dockPillStyles.labelDisabled]}>
        Reveal
      </Text>
    </Pressable>
  );
}

function GraveyardPill({
  discardCount,
  onPress,
}: {
  discardCount: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={dockPillStyles.pill}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Graveyard, ${discardCount} cards out of play`}
    >
      <Text style={dockPillStyles.icon}>☠</Text>
      <Text style={dockPillStyles.label}>Grave</Text>
      {discardCount > 0 && (
        <View style={dockPillStyles.badge}>
          <Text style={dockPillStyles.badgeText}>{discardCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

export interface AbilityDockProps {
  discardCount: number;
  canReveal: boolean;
  onGraveyardPress: () => void;
  onRevealPress: () => void;
}

export function AbilityDock({
  discardCount,
  canReveal,
  onGraveyardPress,
  onRevealPress,
}: AbilityDockProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="toolbar"
      accessibilityLabel="Game abilities"
    >
      <RevealPill canReveal={canReveal} onPress={onRevealPress} />
      <GraveyardPill discardCount={discardCount} onPress={onGraveyardPress} />
      <ReturnPill />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: spacing.sm,
    height: DOCK_ROW_HEIGHT,
  },
});
