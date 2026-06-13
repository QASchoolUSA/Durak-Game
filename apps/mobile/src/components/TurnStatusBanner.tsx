import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { TurnStatus, TurnTone } from "../game/selectors";
import { useUiTheme } from "../theme/UiThemeContext";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { colors, radius } from "../theme";

export interface TurnStatusBannerProps {
  status: TurnStatus | null;
}

/** Whether this tone is a call to action for the local player (vs. waiting). */
function isYourTurn(tone: TurnTone): boolean {
  return tone === "you-attack" || tone === "you-defend" || tone === "you-throw";
}

function toneColor(tone: TurnTone, mutedColor: string): string {
  switch (tone) {
    case "you-attack":
    case "you-throw":
      return colors.success;
    case "you-defend":
      return colors.danger;
    default:
      return mutedColor;
  }
}

function TurnStatusBannerComponent({ status }: TurnStatusBannerProps) {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();

  if (!status) return null;

  const yourTurn = isYourTurn(status.tone);
  const accent = toneColor(status.tone, ui.textMuted);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        // Re-key on text so the pill cross-fades when the prompt changes.
        key={status.text}
        entering={reduceMotion ? undefined : FadeIn.duration(220)}
        style={[
          styles.pill,
          {
            backgroundColor: ui.panelBg,
            borderColor: yourTurn ? accent : ui.panelBorderSoft,
            borderWidth: yourTurn ? 1.5 : 1,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text
          style={[styles.text, { color: yourTurn ? ui.textPrimary : ui.textMuted }]}
          numberOfLines={1}
        >
          {status.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    maxWidth: "92%",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});

export const TurnStatusBanner = React.memo(TurnStatusBannerComponent);
