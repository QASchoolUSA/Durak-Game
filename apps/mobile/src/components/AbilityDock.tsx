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
  onGraveyardPress: () => void;
}

export function AbilityDock({ discardCount, onGraveyardPress }: AbilityDockProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="toolbar"
      accessibilityLabel="Game abilities"
    >
      <GraveyardPill discardCount={discardCount} onPress={onGraveyardPress} />
      <ReturnPill />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: DOCK_ROW_HEIGHT,
  },
});
