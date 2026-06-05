import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGameStore } from "../game/store";
import {
  GRAVEYARD_GOLD_COST,
  REVEAL_GOLD_COST,
  canAffordGold,
} from "../game/goldEconomy";
import { trigger } from "../feedback/haptics";
import { DOCK_ROW_HEIGHT, useDockPillStyles } from "./dockPill";
import { spacing } from "../theme";

function ReturnPill() {
  const dockPillStyles = useDockPillStyles();
  const returnSnapshot = useGameStore((s) => s.returnSnapshot);
  const returnExpiresAt = useGameStore((s) => s.returnExpiresAt);
  const playMode = useGameStore((s) => s.playMode);
  const returnLastCard = useGameStore((s) => s.returnLastCard);
  const [remaining, setRemaining] = useState(0);

  const windowActive =
    playMode === "online"
      ? returnExpiresAt > Date.now()
      : !!returnSnapshot && returnExpiresAt > Date.now();

  useEffect(() => {
    if (!windowActive || !returnExpiresAt) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      setRemaining(Math.max(0, (returnExpiresAt - Date.now()) / 1000));
    };

    tick();
    const iv = setInterval(tick, 50);
    return () => clearInterval(iv);
  }, [windowActive, returnExpiresAt]);

  if (!windowActive || remaining <= 0) {
    return null;
  }

  return (
    <Pressable
      style={[dockPillStyles.pill, dockPillStyles.pillUrgent, styles.pill]}
      onPress={() => {
        trigger("uiTap");
        returnLastCard();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Return card, ${Math.ceil(remaining)} seconds left`}
    >
      <Text style={dockPillStyles.icon}>↩</Text>
      <Text style={[dockPillStyles.label, styles.label]} numberOfLines={1}>
        Return
      </Text>
      <Text style={dockPillStyles.countdown}>{Math.ceil(remaining)}</Text>
    </Pressable>
  );
}

function CostBadge({ cost }: { cost: number }) {
  const dockPillStyles = useDockPillStyles();
  if (cost <= 0) return null;
  return (
    <View style={dockPillStyles.badge}>
      <Text style={dockPillStyles.badgeText}>🪙{cost}</Text>
    </View>
  );
}

function RevealPill({
  canReveal,
  onPress,
}: {
  canReveal: boolean;
  onPress: () => void;
}) {
  const dockPillStyles = useDockPillStyles();

  return (
    <Pressable
      style={[
        dockPillStyles.pill,
        styles.pill,
        !canReveal && dockPillStyles.pillDisabled,
      ]}
      onPress={onPress}
      disabled={!canReveal}
      accessibilityRole="button"
      accessibilityLabel={
        canReveal ? "Reveal an opponent card" : "Reveal unavailable"
      }
      accessibilityState={{ disabled: !canReveal }}
    >
      <Text style={dockPillStyles.icon}>👁</Text>
      <Text
        style={[dockPillStyles.label, styles.label, !canReveal && dockPillStyles.labelDisabled]}
        numberOfLines={1}
      >
        Reveal
      </Text>
      <CostBadge cost={REVEAL_GOLD_COST} />
    </Pressable>
  );
}

function GraveyardPill({
  discardCount,
  canOpen,
  onPress,
}: {
  discardCount: number;
  canOpen: boolean;
  onPress: () => void;
}) {
  const dockPillStyles = useDockPillStyles();

  return (
    <Pressable
      style={[dockPillStyles.pill, styles.pill, !canOpen && dockPillStyles.pillDisabled]}
      onPress={onPress}
      disabled={!canOpen}
      accessibilityRole="button"
      accessibilityLabel={`Graveyard, ${discardCount} cards out of play`}
      accessibilityState={{ disabled: !canOpen }}
    >
      <Text style={dockPillStyles.icon}>☠</Text>
      <Text
        style={[dockPillStyles.label, styles.label, !canOpen && dockPillStyles.labelDisabled]}
        numberOfLines={1}
      >
        Grave
      </Text>
      <CostBadge cost={GRAVEYARD_GOLD_COST} />
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
  canGraveyard: boolean;
  onGraveyardPress: () => void;
  onRevealPress: () => void;
  showGoldFeatures?: boolean;
}

export function AbilityDock({
  discardCount,
  canReveal,
  canGraveyard,
  onGraveyardPress,
  onRevealPress,
  showGoldFeatures = true,
}: AbilityDockProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="toolbar"
      accessibilityLabel="Game abilities"
    >
      {showGoldFeatures && (
        <>
          <RevealPill canReveal={canReveal} onPress={onRevealPress} />
          <GraveyardPill
            discardCount={discardCount}
            canOpen={canGraveyard}
            onPress={onGraveyardPress}
          />
        </>
      )}
      <ReturnPill />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    width: "100%",
    gap: spacing.xs,
    height: DOCK_ROW_HEIGHT,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
  },
});
