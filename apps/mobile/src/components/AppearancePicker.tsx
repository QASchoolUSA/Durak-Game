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
  APPEARANCE_ORDER,
  APPEARANCE_PRESETS,
  getTableSwatchColor,
  type AppearanceId,
  type AppearanceMode,
} from "../theme/appearanceThemes";
import { getCardTheme } from "../theme/cardThemes";
import { colors, radius, spacing, typography } from "../theme";
import { LinearGradient } from "expo-linear-gradient";
import { Card } from "./Card";

const PREVIEW_CARD: CardModel = {
  suit: "spades",
  rank: 14,
  id: "appearance-preview",
};

const PREVIEW_W = 36;
const PREVIEW_H = Math.round(PREVIEW_W * 1.4);
const PREVIEW_STACK_H = PREVIEW_H + 12;
const SWATCH_W = 72;
const SWATCH_H = PREVIEW_STACK_H + 6;

function ModeBadge({ mode }: { mode: AppearanceMode }) {
  const isLight = mode === "light";
  return (
    <View style={[styles.modeBadge, isLight ? styles.modeBadgeLight : styles.modeBadgeDark]}>
      <Text style={[styles.modeBadgeText, isLight ? styles.modeBadgeTextLight : styles.modeBadgeTextDark]}>
        {isLight ? "Light" : "Dark"}
      </Text>
    </View>
  );
}

function AppearanceTile({ id }: { id: AppearanceId }) {
  const cardDesign = usePreferencesStore((s) => s.cardDesign);
  const setAppearance = usePreferencesStore((s) => s.setAppearance);
  const preset = APPEARANCE_PRESETS[id];
  const cardTheme = getCardTheme(id);
  const selected = cardDesign === id;
  const { table } = preset;
  const swatchTop = getTableSwatchColor(table);
  const swatchGrad = table.backgroundGradient;

  return (
    <Pressable
      onPress={() => setAppearance(id)}
      style={[styles.tile, selected && styles.tileSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${preset.name} appearance, ${preset.mode}`}
    >
      <View style={[styles.swatch, { width: SWATCH_W, height: SWATCH_H }]}>
        <View style={styles.swatchBg}>
          {swatchGrad ? (
            <LinearGradient
              colors={swatchGrad}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: swatchTop }]} />
          )}
        </View>
        <View style={styles.previewStack}>
          <Card
            card={PREVIEW_CARD}
            width={PREVIEW_W}
            height={PREVIEW_H}
            themeOverride={cardTheme}
            style={[styles.previewCard, styles.previewFace]}
          />
          <Card
            faceDown
            width={PREVIEW_W}
            height={PREVIEW_H}
            themeOverride={cardTheme}
            style={[styles.previewCard, styles.previewBack]}
          />
        </View>
      </View>
      <Text style={[styles.tileName, selected && styles.tileNameSelected]}>
        {preset.name}
      </Text>
      <ModeBadge mode={preset.mode} />
      {selected && <View style={styles.selectedDot} />}
    </Pressable>
  );
}

export function AppearancePicker() {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {APPEARANCE_ORDER.map((id) => (
          <AppearanceTile key={id} id={id} />
        ))}
      </ScrollView>
      <Text style={styles.hint}>Dark & Day table colors — gameplay only</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing.sm,
    paddingHorizontal: 2,
    paddingVertical: spacing.sm,
  },
  tile: {
    width: 100,
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
  swatch: {
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  previewStack: {
    width: PREVIEW_W + 10,
    height: PREVIEW_STACK_H,
  },
  previewCard: {
    position: "absolute",
    shadowOpacity: 0,
    elevation: 0,
  },
  previewFace: {
    top: 0,
    left: 0,
    zIndex: 2,
  },
  previewBack: {
    top: 8,
    left: 10,
    zIndex: 1,
    opacity: 0.92,
  },
  tileName: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
    textAlign: "center",
  },
  tileNameSelected: {
    color: colors.gold,
  },
  modeBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  modeBadgeLight: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  modeBadgeDark: {
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  modeBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  modeBadgeTextLight: {
    color: colors.textLight,
  },
  modeBadgeTextDark: {
    color: colors.textMuted,
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
