import React, { useCallback, useEffect, useRef } from "react";
import { View, type ViewStyle } from "react-native";
import { type DropZone, type DropZoneKind } from "../game/dropZones";

export type DropSlotReporter = () => void;

export interface MeasuredDropSlotProps {
  tableIndex: number;
  kind: DropZoneKind;
  remeasureKey?: number;
  onDropZoneLayout?: (zone: DropZone) => void;
  onDropZoneRemoved?: (tableIndex: number, kind: DropZoneKind) => void;
  /** Returns unregister when registered. */
  onRegisterReporter?: (reporter: DropSlotReporter) => () => void;
  style?: ViewStyle;
  children?: React.ReactNode;
}

function scheduleMeasure(report: () => void): () => void {
  let innerId = 0;
  const outerId = requestAnimationFrame(() => {
    innerId = requestAnimationFrame(report);
  });
  return () => {
    cancelAnimationFrame(outerId);
    if (innerId) cancelAnimationFrame(innerId);
  };
}

function MeasuredDropSlotComponent({
  tableIndex,
  kind,
  remeasureKey,
  onDropZoneLayout,
  onDropZoneRemoved,
  onRegisterReporter,
  style,
  children,
}: MeasuredDropSlotProps) {
  const ref = useRef<View>(null);
  const reportRef = useRef<() => void>(() => {});

  const report = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      onDropZoneLayout?.({ kind, tableIndex, x, y, width, height });
    });
  }, [tableIndex, kind, onDropZoneLayout]);

  reportRef.current = report;

  useEffect(() => {
    if (!onRegisterReporter) return;
    const unregister = onRegisterReporter(() => reportRef.current());
    return unregister;
  }, [onRegisterReporter, remeasureKey]);

  useEffect(() => {
    return scheduleMeasure(() => reportRef.current());
  }, [remeasureKey]);

  useEffect(() => {
    return () => onDropZoneRemoved?.(tableIndex, kind);
  }, [tableIndex, kind, onDropZoneRemoved]);

  return (
    <View ref={ref} onLayout={() => scheduleMeasure(() => reportRef.current())} style={style} collapsable={false}>
      {children}
    </View>
  );
}

export const MeasuredDropSlot = React.memo(MeasuredDropSlotComponent);
