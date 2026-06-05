import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { type TablePair } from "@durak/game-core";
import { Card } from "./Card";
import { ChoiceDropSlot } from "./ChoiceDropSlot";
import { MeasuredDropSlot } from "./MeasuredDropSlot";
import { useSharedIndex } from "../hooks/useSharedIndex";
import { pairLayoutWidth, type DropZone, type DropZoneKind } from "../game/dropZones";
import {
  computeTableLayout,
  tablePairRows,
  type TableLayoutResult,
} from "../game/tableLayout";

export type TableExitKind = "toHand" | "toOpponent" | "toDiscard";

const EXIT_DURATION = 360;
const ATTACK_ENTER_MS = 220;
const DEFENSE_ENTER_MS = 200;

function makeAttackEnter() {
  return () => {
    "worklet";
    const duration = ATTACK_ENTER_MS;
    return {
      initialValues: {
        opacity: 0,
        transform: [{ translateY: 12 }, { scale: 0.96 }],
      },
      animations: {
        opacity: withTiming(1, { duration }),
        transform: [
          { translateY: withTiming(0, { duration }) },
          { scale: withTiming(1, { duration }) },
        ],
      },
    };
  };
}

function makeDefenseEnter() {
  return () => {
    "worklet";
    const duration = DEFENSE_ENTER_MS;
    return {
      initialValues: {
        opacity: 0,
        transform: [{ translateY: 8 }, { scale: 0.94 }],
      },
      animations: {
        opacity: withTiming(1, { duration }),
        transform: [
          { translateY: withTiming(0, { duration }) },
          { scale: withTiming(1, { duration }) },
        ],
      },
    };
  };
}

type ExitTarget = {
  translateX: number;
  translateY: number;
  rotate: string;
  scale: number;
};

function exitTargetFor(kind: TableExitKind, pairIndex: number): ExitTarget {
  switch (kind) {
    case "toHand":
      return {
        translateX: 12 + pairIndex * 6,
        translateY: 240,
        rotate: "-8deg",
        scale: 0.75,
      };
    case "toOpponent": {
      const spread = (pairIndex - 1.5) * 18;
      return {
        translateX: spread,
        translateY: -165,
        rotate: `${-6 + pairIndex * 2}deg`,
        scale: 0.8,
      };
    }
    case "toDiscard":
    default:
      return {
        translateX: -40 + pairIndex * 12,
        translateY: 52,
        rotate: "4deg",
        scale: 0.88,
      };
  }
}

function makeTableExit(kind: TableExitKind, pairIndex: number) {
  const delay = Math.min(pairIndex * 55, 220);
  const target = exitTargetFor(kind, pairIndex);

  return () => {
    "worklet";
    const duration = EXIT_DURATION;
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
          {
            translateX: withDelay(delay, withTiming(target.translateX, { duration })),
          },
          {
            translateY: withDelay(delay, withTiming(target.translateY, { duration })),
          },
          { rotate: withDelay(delay, withTiming(target.rotate, { duration })) },
          { scale: withDelay(delay, withTiming(target.scale, { duration })) },
        ],
      },
    };
  };
}

const ATTACK_ENTER = makeAttackEnter();
const DEFENSE_ENTER = makeDefenseEnter();
const ATTACK_ENTER_REDUCED = FadeIn.duration(120);
const DEFENSE_ENTER_REDUCED = FadeIn.duration(120);
const EXIT_REDUCED = FadeOut.duration(120);

const MAX_TABLE_PAIRS = 6;

function buildExitCache(kind: TableExitKind) {
  return Array.from({ length: MAX_TABLE_PAIRS }, (_, i) => makeTableExit(kind, i));
}

const TABLE_EXITS: Record<TableExitKind, ReturnType<typeof makeTableExit>[]> = {
  toDiscard: buildExitCache("toDiscard"),
  toHand: buildExitCache("toHand"),
  toOpponent: buildExitCache("toOpponent"),
};

function tableExitFor(kind: TableExitKind, pairIndex: number) {
  return TABLE_EXITS[kind][pairIndex] ?? TABLE_EXITS[kind][0]!;
}

export interface TableAreaHandle {
  remeasureZones: () => void;
}

export interface TableAreaProps {
  table: TablePair[];
  trumpSuit: string;
  layout: TableLayoutResult;
  exitKind?: TableExitKind;
  choiceTargets?: number[];
  transferTargets?: number[];
  hoverDefendIndex?: number | null;
  hoverTransferIndex?: number | null;
  hoverDefendIndexSV?: SharedValue<number>;
  hoverTransferIndexSV?: SharedValue<number>;
  dragActiveSV?: SharedValue<boolean>;
  reduceMotion?: boolean;
  remeasureKey?: number;
  onDropZoneLayout?: (zone: DropZone) => void;
  onDropZoneRemoved?: (tableIndex: number, kind: DropZoneKind) => void;
}

const TableAreaComponent = forwardRef<TableAreaHandle, TableAreaProps>(
  function TableAreaComponent(
    {
      table,
      trumpSuit,
      layout,
      exitKind = "toDiscard",
      choiceTargets = [],
      transferTargets = [],
      hoverDefendIndex = null,
      hoverTransferIndex = null,
      hoverDefendIndexSV,
      hoverTransferIndexSV,
      dragActiveSV,
      reduceMotion = false,
      remeasureKey = 0,
      onDropZoneLayout,
      onDropZoneRemoved,
    },
    ref,
  ) {
    const w = layout.cardW;
    const h = layout.cardH;
    const choiceSet = new Set(choiceTargets);
    const transferSet = new Set(transferTargets);
    const measureZones = Boolean(onDropZoneLayout);
    const reportersRef = useRef(new Set<() => void>());

    const svDefendHover = useSharedIndex(hoverDefendIndexSV, -1);
    const svTransferHover = useSharedIndex(hoverTransferIndexSV, -1);

    const resolvedDefendHover =
      hoverDefendIndexSV != null ? svDefendHover : (hoverDefendIndex ?? -1);
    const resolvedTransferHover =
      hoverTransferIndexSV != null ? svTransferHover : (hoverTransferIndex ?? -1);

    const attackEnter = reduceMotion ? ATTACK_ENTER_REDUCED : ATTACK_ENTER;
    const defenseEnter = reduceMotion ? DEFENSE_ENTER_REDUCED : DEFENSE_ENTER;

    const rows = useMemo(
      () => tablePairRows(table.length, layout.columns),
      [table.length, layout.columns],
    );

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

    const renderPair = (pair: TablePair, i: number) => {
      const showChoice = choiceSet.has(i) && !pair.defense;
      const transferEnabled = transferSet.has(i);
      const beatHover = resolvedDefendHover === i;
      const transferHover = transferEnabled && resolvedTransferHover === i;
      const beatDimmed = showChoice && transferHover;
      const transferDimmed = showChoice && beatHover;
      const pairW = pairLayoutWidth(transferEnabled, w, layout.transferGap);
      const pairH = showChoice ? h + Math.round(layout.pairPadW * 0.5) : h + layout.pairPadW;

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
          availableSV={dragActiveSV}
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
          availableSV={dragActiveSV}
        />
      );

      return (
        <Animated.View
          key={pair.attack.id}
          entering={attackEnter}
          exiting={reduceMotion ? EXIT_REDUCED : tableExitFor(exitKind, i)}
          style={styles.pairCell}
        >
          <View style={[styles.pair, { width: pairW, height: pairH }]}>
            <View style={[styles.attackSlot, { width: w, height: h }]}>
              {showChoice && measureZones ? (
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
              ) : showChoice ? (
                beatSlot
              ) : (
                attackCard
              )}
            </View>

            {showChoice && transferEnabled && (
              <View
                style={[
                  styles.transferSlot,
                  { left: w + layout.transferGap, width: w, height: h },
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
              <Animated.View entering={defenseEnter}>
                <View
                  style={[
                    styles.defense,
                    {
                      top: layout.defenseOffsetTop,
                      left: layout.defenseOffsetLeft,
                    },
                  ]}
                >
                  <Card
                    card={pair.defense}
                    width={w}
                    height={h}
                    trump={pair.defense.suit === trumpSuit}
                  />
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      );
    };

    return (
      <View
        style={[
          styles.container,
          {
            paddingHorizontal: layout.containerPadH,
            paddingVertical: layout.containerPadV,
            gap: layout.gap,
          },
        ]}
      >
        {rows.map((indices, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[styles.row, { gap: layout.gap }]}
          >
            {indices.map((i) => renderPair(table[i]!, i))}
          </View>
        ))}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  pairCell: {
    alignItems: "center",
    justifyContent: "center",
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
  defense: {
    position: "absolute",
    transform: [{ rotate: "5deg" }],
  },
});

export const TableArea = React.memo(TableAreaComponent);
