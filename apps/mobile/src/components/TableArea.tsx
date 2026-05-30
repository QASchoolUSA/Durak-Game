import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { type TablePair } from "@durak/game-core";
import { Card } from "./Card";
import {
  TRANSFER_CHOICE_LAYOUT,
  pairLayoutWidth,
  transferHitHeight,
  transferHitWidth,
  type ScreenRect,
} from "../game/dropZones";
import { cardSize, colors, radius, spacing } from "../theme";

/**
 * Round-clear sweep: when the table empties, each pair slides off toward the
 * deck/discard (upper right), rotating and fading. `delay` cascades them.
 */
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

export interface TableAreaProps {
  table: TablePair[];
  trumpSuit: string;
  transferTargets?: number[];
  hoverDefendIndex?: number | null;
  hoverTransferIndex?: number | null;
  remeasureKey?: number;
  /** Single window-space anchor per pair — used to derive both drop zones. */
  onPairAnchorLayout?: (tableIndex: number, anchor: ScreenRect, showTransfer: boolean) => void;
}

interface MeasuredPairProps {
  tableIndex: number;
  showTransfer: boolean;
  remeasureKey?: number;
  onAnchorLayout?: TableAreaProps["onPairAnchorLayout"];
  style?: object;
  children?: React.ReactNode;
}

function MeasuredPair({
  tableIndex,
  showTransfer,
  remeasureKey,
  onAnchorLayout,
  style,
  children,
}: MeasuredPairProps) {
  const ref = useRef<View>(null);

  const report = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      onAnchorLayout?.(tableIndex, { x, y, width, height }, showTransfer);
    });
  }, [tableIndex, showTransfer, onAnchorLayout]);

  useEffect(() => {
    const id = requestAnimationFrame(report);
    return () => cancelAnimationFrame(id);
  }, [report, remeasureKey]);

  return (
    <View ref={ref} onLayout={report} style={style} collapsable={false}>
      {children}
    </View>
  );
}

interface TransferSlotProps {
  width: number;
  height: number;
  active: boolean;
  dimmed: boolean;
}

function TransferSlot({ width, height, active, dimmed }: TransferSlotProps) {
  const iconSize = Math.round(width * 0.42);

  return (
    <View style={[styles.transferWrap, { width, height }, dimmed && styles.slotDimmed]}>
      <Card faceDown width={width} height={height} dimmed={dimmed && !active} highlighted={active} />
      <View
        pointerEvents="none"
        style={[styles.transferOverlay, active && styles.transferOverlayActive]}
      >
        <Text
          style={[
            styles.transferIcon,
            { fontSize: iconSize, lineHeight: iconSize },
            active && styles.transferIconActive,
          ]}
        >
          {"\u21AA"}
        </Text>
      </View>
    </View>
  );
}

function TableAreaComponent({
  table,
  trumpSuit,
  transferTargets = [],
  hoverDefendIndex = null,
  hoverTransferIndex = null,
  remeasureKey = 0,
  onPairAnchorLayout,
}: TableAreaProps) {
  const { w, h } = cardSize.table;
  const transferSet = new Set(transferTargets);
  const hitW = transferHitWidth();
  const hitH = transferHitHeight();

  return (
    <View style={styles.container}>
      {table.map((pair, i) => {
        const showTransfer = transferSet.has(i) && !pair.defense;
        const beatHover = hoverDefendIndex === i;
        const transferHover = hoverTransferIndex === i;
        const beatDimmed = showTransfer && transferHover;
        const transferDimmed = showTransfer && beatHover;
        const pairW = pairLayoutWidth(showTransfer);
        const pairH = showTransfer ? Math.max(h, hitH) + 8 : h + 16;

        return (
          <Animated.View
            key={pair.attack.id}
            entering={FadeIn.duration(180)}
            exiting={makeSweepOut(i * 55)}
          >
            <MeasuredPair
              tableIndex={i}
              showTransfer={showTransfer}
              remeasureKey={remeasureKey}
              onAnchorLayout={onPairAnchorLayout}
              style={[styles.pair, { width: pairW, height: pairH }]}
            >
              <View
                style={[
                  styles.attackSlot,
                  { width: w, height: h },
                  beatHover && styles.attackHover,
                  beatDimmed && styles.slotDimmed,
                ]}
              >
                <Card
                  card={pair.attack}
                  width={w}
                  height={h}
                  trump={pair.attack.suit === trumpSuit}
                  highlighted={beatHover}
                />
              </View>

              {showTransfer && (
                <View
                  style={[
                    styles.transferHitArea,
                    {
                      left: w + TRANSFER_CHOICE_LAYOUT.gap,
                      width: hitW,
                      height: hitH,
                    },
                    transferHover && styles.transferHitActive,
                    transferDimmed && styles.slotDimmed,
                  ]}
                >
                  <TransferSlot width={w} height={h} active={transferHover} dimmed={transferDimmed} />
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
            </MeasuredPair>
          </Animated.View>
        );
      })}
    </View>
  );
}

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
    borderRadius: radius.card,
    overflow: "hidden",
  },
  attackHover: {
    shadowColor: colors.success,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  slotDimmed: {
    opacity: 0.38,
  },
  defense: { position: "absolute", top: 16, left: 14 },
  transferHitArea: {
    position: "absolute",
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.card,
  },
  transferHitActive: {
    backgroundColor: "rgba(231, 192, 103, 0.08)",
    borderRadius: radius.card,
  },
  transferWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radius.card,
  },
  transferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7, 42, 32, 0.55)",
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.goldDim,
  },
  transferOverlayActive: {
    borderStyle: "solid",
    borderColor: colors.gold,
    backgroundColor: "rgba(15, 53, 40, 0.72)",
  },
  transferIcon: {
    color: colors.goldDim,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
  transferIconActive: { color: colors.gold },
});

export const TableArea = React.memo(TableAreaComponent);
