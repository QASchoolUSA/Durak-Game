import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { roundedRectOutlinePath } from "../game/roundedRectOutline";

const DEFAULT_STROKE = 2.5;

export interface TurnTimerRingProps {
  visible: boolean;
  color: string;
  maxBorderRadius: number;
  strokeWidth?: number;
  /** 0–1 turn time remaining (1 = full). */
  progress: number;
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

  if (!visible || !outline) return null;

  const perimeter = outline.perimeter;
  const clamped = clockActive ? Math.max(0, Math.min(1, progress)) : 1;

  return (
    <Svg
      width={width}
      height={height}
      style={[styles.svg, { width, height }]}
      pointerEvents="none"
    >
      <Path
        d={outline.d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeDasharray={perimeter}
        strokeDashoffset={perimeter * (1 - clamped)}
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
