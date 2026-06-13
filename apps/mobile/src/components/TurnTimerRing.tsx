import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated";
import { roundedRectOutlinePath } from "../game/roundedRectOutline";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DEFAULT_STROKE = 2.5;

export interface TurnTimerRingProps {
  visible: boolean;
  color: string;
  maxBorderRadius: number;
  strokeWidth?: number;
  /** 0–1 turn time remaining (1 = full), animated on the UI thread. */
  progress: SharedValue<number>;
  /** When false, ring stays full (e.g. taking animation without live clock). */
  clockActive: boolean;
  width: number;
  height: number;
}

function TurnTimerRingComponent({
  visible,
  color,
  maxBorderRadius,
  strokeWidth = DEFAULT_STROKE,
  progress,
  clockActive,
  width,
  height,
}: TurnTimerRingProps) {
  const outline = useMemo(
    () => roundedRectOutlinePath(width, height, maxBorderRadius, strokeWidth),
    [width, height, maxBorderRadius, strokeWidth],
  );

  const perimeter = outline?.perimeter ?? 0;

  // Runs on the UI thread — the ring redraws from the shared value without any
  // React re-render or JS-thread tick.
  const animatedProps = useAnimatedProps(() => {
    const clamped = clockActive ? Math.max(0, Math.min(1, progress.value)) : 1;
    return { strokeDashoffset: perimeter * (1 - clamped) };
  });

  if (!visible || !outline) return null;

  return (
    <Svg
      width={width}
      height={height}
      style={[styles.svg, { width, height }]}
      pointerEvents="none"
    >
      <AnimatedPath
        d={outline.d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeDasharray={perimeter}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "visible",
    zIndex: 10,
  },
});

export const TurnTimerRing = React.memo(TurnTimerRingComponent);
