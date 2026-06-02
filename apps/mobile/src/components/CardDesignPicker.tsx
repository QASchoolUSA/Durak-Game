import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Card as CardModel } from "@durak/game-core";
import { usePreferencesStore } from "../game/preferencesStore";
import {
  CARD_DESIGN_ORDER,
  CARD_THEMES,
  type CardDesignId,
} from "../theme/cardThemes";
import { colors, radius, spacing, typography } from "../theme";
import { Card } from "./Card";

const PREVIEW_CARD: CardModel = {
  suit: "spades",
  rank: 14,
  id: "design-preview",
};

const PREVIEW_W = 40;
const PREVIEW_H = Math.round(PREVIEW_W * 1.4);

function CardDesignTile({ id }: { id: CardDesignId }) {
  const cardDesign = usePreferencesStore((s) => s.cardDesign);
  const setCardDesign = usePreferencesStore((s) => s.setCardDesign);
  const theme = CARD_THEMES[id];
  const selected = cardDesign === id;

  return (
    <Pressable
      onPress={() => setCardDesign(id)}
      style={[styles.tile, selected && styles.tileSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${theme.name} card design`}
    >
      <View style={styles.previewStack}>
        <Card
          card={PREVIEW_CARD}
          width={PREVIEW_W}
          height={PREVIEW_H}
          themeOverride={theme}
          style={styles.previewFace}
        />
        <Card
          faceDown
          width={PREVIEW_W}
          height={PREVIEW_H}
          themeOverride={theme}
          style={styles.previewBack}
        />
      </View>
      <Text style={[styles.tileName, selected && styles.tileNameSelected]}>
        {theme.name}
      </Text>
      {selected && <View style={styles.selectedDot} />}
    </Pressable>
  );
}

export function CardDesignPicker() {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CARD_DESIGN_ORDER.map((id) => (
          <CardDesignTile key={id} id={id} />
        ))}
      </ScrollView>
      <Text style={styles.hint}>Applies to all cards in game</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing.sm,
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  tile: {
    width: 88,
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm + 4,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  tileSelected: {
    borderColor: colors.gold,
    backgroundColor: "rgba(231,192,103,0.10)",
  },
  previewStack: {
    width: PREVIEW_W + 12,
    height: PREVIEW_H + 14,
    marginBottom: spacing.sm,
  },
  previewFace: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 2,
  },
  previewBack: {
    position: "absolute",
    top: 10,
    left: 12,
    zIndex: 1,
    opacity: 0.92,
  },
  tileName: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  tileNameSelected: {
    color: colors.gold,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginTop: 4,
  },
  hint: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.sm,
    marginLeft: 4,
  },
});
