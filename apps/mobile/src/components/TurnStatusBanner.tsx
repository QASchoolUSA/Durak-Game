import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  Keyframe,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { TurnStatus, TurnTone } from "../game/selectors";
import { useUiTheme } from "../theme/UiThemeContext";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { colors, radius } from "../theme";

export interface TurnStatusBannerProps {
  status: TurnStatus | null;
}

/** Fixed slot height so show/hide never shifts seats (wrap + pill + text line). */
const SLOT_MIN_HEIGHT = 34;
const TEXT_LINE_HEIGHT = 16;
const TICKER_MS = 280;
const TICKER_TRAVEL = 5;
const easeOut = Easing.out(Easing.cubic);

const textEnterTicker = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateY: TICKER_TRAVEL }],
  },
  100: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
}).duration(TICKER_MS);

const textExitTicker = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  100: {
    opacity: 0,
    transform: [{ translateY: -TICKER_TRAVEL }],
  },
}).duration(220);

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

  const yourTurn = status ? isYourTurn(status.tone) : false;
  const accent = status ? toneColor(status.tone, ui.textMuted) : ui.textMuted;
  const borderTarget = yourTurn ? accent : ui.panelBorderSoft;
  const textTarget = yourTurn ? ui.textPrimary : ui.textMuted;

  const accentSv = useSharedValue(accent);
  const borderSv = useSharedValue(borderTarget);
  const textSv = useSharedValue(textTarget);
  const borderWidthSv = useSharedValue(yourTurn ? 1.5 : 1);
  const dotScaleSv = useSharedValue(1);
  const prevYourTurn = useSharedValue(yourTurn ? 1 : 0);

  useEffect(() => {
    const duration = reduceMotion ? 0 : TICKER_MS;
    const timing = { duration, easing: easeOut };
    accentSv.value = withTiming(accent, timing);
    borderSv.value = withTiming(borderTarget, timing);
    textSv.value = withTiming(textTarget, timing);
    borderWidthSv.value = withTiming(yourTurn ? 1.5 : 1, timing);

    const nextFlag = yourTurn ? 1 : 0;
    if (!reduceMotion && nextFlag === 1 && prevYourTurn.value === 0) {
      dotScaleSv.value = withSequence(
        withTiming(1.35, { duration: 140, easing: easeOut }),
        withTiming(1, { duration: 180, easing: easeOut }),
      );
    } else if (reduceMotion) {
      dotScaleSv.value = 1;
    }
    prevYourTurn.value = nextFlag;
  }, [
    accent,
    borderTarget,
    textTarget,
    yourTurn,
    reduceMotion,
    accentSv,
    borderSv,
    textSv,
    borderWidthSv,
    dotScaleSv,
    prevYourTurn,
  ]);

  const pillStyle = useAnimatedStyle(() => ({
    borderColor: borderSv.value,
    borderWidth: borderWidthSv.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    backgroundColor: accentSv.value,
    transform: [{ scale: dotScaleSv.value }],
  }));

  const textColorStyle = useAnimatedStyle(() => ({
    color: textSv.value,
  }));

  const layout = reduceMotion
    ? undefined
    : LinearTransition.duration(TICKER_MS).easing(easeOut);
  const pillEnter = reduceMotion ? undefined : FadeIn.duration(220);
  const pillExit = reduceMotion ? undefined : FadeOut.duration(180);
  const textEnter = reduceMotion ? undefined : textEnterTicker;
  const textExit = reduceMotion ? undefined : textExitTicker;

  return (
    <Animated.View pointerEvents="none" style={styles.wrap}>
      {status ? (
        <Animated.View
          entering={pillEnter}
          exiting={pillExit}
          layout={layout}
          style={[styles.pill, { backgroundColor: ui.panelBg }, pillStyle]}
        >
          <Animated.View style={[styles.dot, dotStyle]} />
          <View style={styles.textStage}>
            <Animated.Text
              key={status.text}
              entering={textEnter}
              exiting={textExit}
              layout={layout}
              style={[styles.text, textColorStyle]}
              numberOfLines={1}
            >
              {status.text}
            </Animated.Text>
          </View>
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
    overflow: "hidden",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  textStage: {
    height: TEXT_LINE_HEIGHT,
    justifyContent: "center",
    flexShrink: 1,
    overflow: "hidden",
  },
  text: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.2,
    lineHeight: TEXT_LINE_HEIGHT,
    flexShrink: 1,
  },
});

export const TurnStatusBanner = React.memo(TurnStatusBannerComponent);
