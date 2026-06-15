import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useUiTheme } from "../theme/UiThemeContext";

const SIZE = 36;
const STROKE = 2.5;

export function BootSpinner() {
  const ui = useUiTheme();
  const reduceMotion = useReduceMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(
      withTiming(360, { duration: 850, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduceMotion, spin]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View
        style={[
          styles.track,
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            borderColor: ui.panelBorderSoft,
          },
        ]}
      />

      {reduceMotion ? (
        <View
          style={[
            styles.arc,
            {
              width: SIZE,
              height: SIZE,
              borderRadius: SIZE / 2,
              borderTopColor: ui.accent,
              borderRightColor: ui.accentMuted,
            },
          ]}
        />
      ) : (
        <Animated.View style={[styles.arcLayer, arcStyle]}>
          <View
            style={[
              styles.arc,
              {
                width: SIZE,
                height: SIZE,
                borderRadius: SIZE / 2,
                borderTopColor: ui.accent,
                borderRightColor: ui.accentMuted,
              },
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    position: "absolute",
    borderWidth: STROKE,
    opacity: 0.45,
  },
  arcLayer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  arc: {
    borderWidth: STROKE,
    borderColor: "transparent",
  },
});
