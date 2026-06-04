import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
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

export interface TableAreaHandle {
  remeasureZones: () => void;
}

export interface TableAreaProps {
  table: TablePair[];
  trumpSuit: string;
  /** Where table cards visually go when the bout clears. */
  exitKind?: TableExitKind;
  /** Pairs that show beat + transfer slot signs (Perevodnoy opening defend). */
  choiceTargets?: number[];
  /** Subset of choiceTargets where transfer drop is legal. */
  transferTargets?: number[];
  hoverDefendIndex?: number | null;
  hoverTransferIndex?: number | null;
  /** True while the player is dragging — show zones as available targets. */
  dragActive?: boolean;
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
      exitKind = "toDiscard",
      choiceTargets = [],
      transferTargets = [],
      hoverDefendIndex = null,
      hoverTransferIndex = null,
      dragActive = false,
      reduceMotion = false,
      remeasureKey = 0,
      onDropZoneLayout,
      onDropZoneRemoved,
    },
    ref,
  ) {
    const { w, h } = cardSize.table;
    const choiceSet = new Set(choiceTargets);
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

    const attackEnter = reduceMotion ? FadeIn.duration(120) : makeAttackEnter();
    const defenseEnter = reduceMotion ? FadeIn.duration(120) : makeDefenseEnter();

    return (
      <View style={styles.container}>
        {table.map((pair, i) => {
          const showChoice = choiceSet.has(i) && !pair.defense;
          const transferEnabled = transferSet.has(i);
          const beatHover = hoverDefendIndex === i;
          const transferHover = transferEnabled && hoverTransferIndex === i;
          const beatDimmed = showChoice && transferHover;
          const transferDimmed = showChoice && beatHover;
          const pairW = pairLayoutWidth(showChoice);
          const pairH = showChoice ? h + 8 : h + 16;

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
              available={dragActive}
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
              disabled={!transferEnabled}
              available={dragActive}
            />
          );

          return (
            <Animated.View
              key={pair.attack.id}
              entering={attackEnter}
              exiting={makeTableExit(exitKind, i)}
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

                {showChoice && (
                  <View
                    style={[
                      styles.transferSlot,
                      { left: w + TRANSFER_CHOICE_LAYOUT.gap, width: w, height: h },
                    ]}
                  >
                    {transferEnabled && measureZones ? (
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
                    <View style={styles.defense}>
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
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    top: 14,
    left: 12,
    transform: [{ rotate: "5deg" }],
  },
});

export const TableArea = React.memo(TableAreaComponent);
