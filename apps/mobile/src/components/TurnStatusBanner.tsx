import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { TurnStatus, TurnTone } from "../game/selectors";
import { useUiTheme } from "../theme/UiThemeContext";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { colors, radius } from "../theme";

export interface TurnStatusBannerProps {
  status: TurnStatus | null;
}

/** Fixed slot height so show/hide never shifts seats (wrap + pill + text line). */
const SLOT_MIN_HEIGHT = 34;

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
    case "confirming":
      return "#F59E0B";
    case "reconnecting":
      return "#60A5FA";
    default:
      return mutedColor;
  }
}

function TurnStatusBannerComponent({ status }: TurnStatusBannerProps) {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();

  return (
    <Animated.View pointerEvents="none" style={styles.wrap}>
      {status ? (
        <Animated.View
          // Re-key on text so the pill cross-fades when the prompt changes.
          key={status.text}
          entering={reduceMotion ? undefined : FadeIn.duration(220)}
          exiting={reduceMotion ? undefined : FadeOut.duration(180)}
          style={[
            styles.pill,
            {
              backgroundColor: ui.panelBg,
              borderColor: isYourTurn(status.tone)
                ? toneColor(status.tone, ui.textMuted)
                : ui.panelBorderSoft,
              borderWidth: isYourTurn(status.tone) ? 1.5 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: toneColor(status.tone, ui.textMuted) },
            ]}
          />
          <Text
            style={[
              styles.text,
              {
                color: isYourTurn(status.tone) ? ui.textPrimary : ui.textMuted,
              },
            ]}
            numberOfLines={1}
          >
            {status.text}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: SLOT_MIN_HEIGHT,
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
