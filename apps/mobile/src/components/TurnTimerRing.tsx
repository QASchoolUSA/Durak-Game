import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated";
import { roundedRectOutlinePath } from "../game/roundedRectOutline";

/** Expiry haptics (timerWarning / timerCritical) are driven by turnClockEngine, not this ring. */
const AnimatedPath = Animated.createAnimatedComponent(Path);

const DEFAULT_STROKE = 2.5;

export interface TurnTimerRingProps {
  visible: boolean;
  color: string;
  maxBorderRadius: number;
  strokeWidth?: number;
  progressSV: SharedValue<number>;
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
  progressSV,
  clockActive,
  width,
  height,
}: TurnTimerRingProps) {
  const outline = useMemo(
    () => roundedRectOutlinePath(width, height, maxBorderRadius, strokeWidth),
    [width, height, maxBorderRadius, strokeWidth],
  );

  const perimeter = outline?.perimeter ?? 0;

  const animatedProps = useAnimatedProps(
    () => {
      "worklet";
      if (perimeter <= 0) {
        return { strokeDashoffset: 0, opacity: 0 };
      }

      const progress = clockActive
        ? Math.max(0, Math.min(1, progressSV.value))
        : 1;

      const opacity =
        clockActive && progress < 0.02 ? 0.35 : 1;

      return {
        strokeDashoffset: perimeter * (1 - progress),
        opacity,
      };
    },
    [clockActive, perimeter],
  );

  if (!visible || !outline) return null;

  return (
    <Svg
      width={width}
      height={height}
      style={[styles.svg, { width, height }]}
      pointerEvents="none"
    >
      <AnimatedPath
        animatedProps={animatedProps}
        d={outline.d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeDasharray={outline.perimeter}
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
