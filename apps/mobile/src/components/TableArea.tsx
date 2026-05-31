import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { type TablePair } from "@durak/game-core";
import { Card } from "./Card";
import { ChoiceDropSlot } from "./ChoiceDropSlot";
import { MeasuredDropSlot } from "./MeasuredDropSlot";
import {
  TRANSFER_CHOICE_LAYOUT,
  pairLayoutWidth,
  type DropZone,
  type DropZoneKind,
} from "../game/dropZones";
import { cardSize, spacing } from "../theme";

function makeSweepOut(delay: number) {
  return () => {
    "worklet";
    const duration = 360;
    return {
      initialValues: {
        opacity: 1,
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { rotate: "0deg" },
          { scale: 1 },
        ],
      },
      animations: {
        opacity: withDelay(delay, withTiming(0, { duration })),
        transform: [
          { translateX: withDelay(delay, withTiming(280, { duration })) },
          { translateY: withDelay(delay, withTiming(-130, { duration })) },
          { rotate: withDelay(delay, withTiming("32deg", { duration })) },
          { scale: withDelay(delay, withTiming(0.82, { duration })) },
        ],
      },
    };
  };
}

export interface TableAreaHandle {
  remeasureZones: () => void;
}

export interface TableAreaProps {
  table: TablePair[];
  trumpSuit: string;
  transferTargets?: number[];
  hoverDefendIndex?: number | null;
  hoverTransferIndex?: number | null;
  remeasureKey?: number;
  onDropZoneLayout?: (zone: DropZone) => void;
  onDropZoneRemoved?: (tableIndex: number, kind: DropZoneKind) => void;
}

const TableAreaComponent = forwardRef<TableAreaHandle, TableAreaProps>(
  function TableAreaComponent(
    {
      table,
      trumpSuit,
      transferTargets = [],
      hoverDefendIndex = null,
      hoverTransferIndex = null,
      remeasureKey = 0,
      onDropZoneLayout,
      onDropZoneRemoved,
    },
    ref,
  ) {
    const { w, h } = cardSize.table;
    const transferSet = new Set(transferTargets);
    const measureZones = Boolean(onDropZoneLayout);
    const reportersRef = useRef(new Set<() => void>());

    const registerSlotReporter = useCallback((reporter: () => void) => {
      reportersRef.current.add(reporter);
      return () => {
        reportersRef.current.delete(reporter);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      remeasureZones: () => {
        for (const report of reportersRef.current) {
          report();
        }
      },
    }));

    return (
      <View style={styles.container}>
        {table.map((pair, i) => {
          const showTransfer = transferSet.has(i) && !pair.defense;
          const beatHover = hoverDefendIndex === i;
          const transferHover = hoverTransferIndex === i;
          const beatDimmed = showTransfer && transferHover;
          const transferDimmed = showTransfer && beatHover;
          const pairW = pairLayoutWidth(showTransfer);
          const pairH = showTransfer ? h + 8 : h + 16;

          const attackCard = (
            <Card
              card={pair.attack}
              width={w}
              height={h}
              trump={pair.attack.suit === trumpSuit}
            />
          );

          const beatSlot = (
            <ChoiceDropSlot
              variant="beat"
              width={w}
              height={h}
              active={beatHover}
              dimmed={beatDimmed}
            >
              {attackCard}
            </ChoiceDropSlot>
          );

          const transferSlot = (
            <ChoiceDropSlot
              variant="transfer"
              width={w}
              height={h}
              active={transferHover}
              dimmed={transferDimmed}
            />
          );

          return (
            <Animated.View
              key={pair.attack.id}
              entering={FadeIn.duration(180)}
              exiting={makeSweepOut(i * 55)}
            >
              <View style={[styles.pair, { width: pairW, height: pairH }]}>
                <View style={[styles.attackSlot, { width: w, height: h }]}>
                  {showTransfer && measureZones ? (
                    <MeasuredDropSlot
                      tableIndex={i}
                      kind="defend"
                      remeasureKey={remeasureKey}
                      onDropZoneLayout={onDropZoneLayout}
                      onDropZoneRemoved={onDropZoneRemoved}
                      onRegisterReporter={registerSlotReporter}
                    >
                      {beatSlot}
                    </MeasuredDropSlot>
                  ) : showTransfer ? (
                    beatSlot
                  ) : (
                    attackCard
                  )}
                </View>

                {showTransfer && (
                  <View
                    style={[
                      styles.transferSlot,
                      { left: w + TRANSFER_CHOICE_LAYOUT.gap, width: w, height: h },
                    ]}
                  >
                    {measureZones ? (
                      <MeasuredDropSlot
                        tableIndex={i}
                        kind="transfer"
                        remeasureKey={remeasureKey}
                        onDropZoneLayout={onDropZoneLayout}
                        onDropZoneRemoved={onDropZoneRemoved}
                        onRegisterReporter={registerSlotReporter}
                      >
                        {transferSlot}
                      </MeasuredDropSlot>
                    ) : (
                      transferSlot
                    )}
                  </View>
                )}

                {pair.defense && (
                  <Animated.View entering={ZoomIn.duration(200)} style={styles.defense}>
                    <Card
                      card={pair.defense}
                      width={w}
                      height={h}
                      trump={pair.defense.suit === trumpSuit}
                    />
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pair: { position: "relative" },
  attackSlot: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  transferSlot: {
    position: "absolute",
    top: 0,
  },
  defense: { position: "absolute", top: 16, left: 14 },
});

export const TableArea = React.memo(TableAreaComponent);
