import React, { useCallback, useEffect, useRef } from "react";
import { View, type ViewStyle } from "react-native";
import { anchorCenter, type AnchorRect } from "../game/anchorMath";

export type { AnchorRect };
export { anchorCenter };

export interface MeasuredAnchorProps {
  anchorId: string;
  onAnchorLayout?: (anchorId: string, rect: AnchorRect) => void;
  onAnchorRemoved?: (anchorId: string) => void;
  remeasureKey?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}

function scheduleMeasure(report: () => void): () => void {
  const id = requestAnimationFrame(report);
  return () => cancelAnimationFrame(id);
}

function MeasuredAnchorComponent({
  anchorId,
  onAnchorLayout,
  onAnchorRemoved,
  remeasureKey,
  style,
  children,
}: MeasuredAnchorProps) {
  const ref = useRef<View>(null);
  const reportRef = useRef<() => void>(() => {});

  const report = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      onAnchorLayout?.(anchorId, { x, y, width, height });
    });
  }, [anchorId, onAnchorLayout]);

  reportRef.current = report;

  useEffect(() => {
    return scheduleMeasure(() => reportRef.current());
  }, [remeasureKey]);

  useEffect(() => {
    return () => onAnchorRemoved?.(anchorId);
  }, [anchorId, onAnchorRemoved]);

  return (
    <View
      ref={ref}
      onLayout={() => scheduleMeasure(() => reportRef.current())}
      style={style}
      collapsable={false}
    >
      {children}
    </View>
  );
}

export const MeasuredAnchor = React.memo(MeasuredAnchorComponent);
