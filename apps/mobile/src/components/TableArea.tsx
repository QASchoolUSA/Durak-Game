import React, { useCallback, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { type TablePair } from "@durak/game-core";
import { Card } from "./Card";
import { type DropZoneKind, type ScreenRect } from "../game/dropZones";
import { cardSize, colors, radius, spacing } from "../theme";

const TRANSFER_SLOT_W = 44;

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
  /** Undefended attacks the human can beat with some card in hand. */
  defendTargets?: number[];
  /** Attacks the currently dragged card can beat — stronger highlight. */
  defendDragTargets?: number[];
  /** Table indices that show a perevodnoy transfer slot beside the attack. */
  transferTargets?: number[];
  /** Highlight transfer slots while the defender drags a transferable card. */
  transferHighlight?: boolean;
  onDropZoneLayout?: (kind: DropZoneKind, tableIndex: number, rect: ScreenRect) => void;
}

interface MeasuredSlotProps {
  kind: DropZoneKind;
  tableIndex: number;
  onLayout?: TableAreaProps["onDropZoneLayout"];
  style?: object;
  children?: React.ReactNode;
}

function MeasuredSlot({ kind, tableIndex, onLayout, style, children }: MeasuredSlotProps) {
  const ref = useRef<View>(null);

  const report = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      onLayout?.(kind, tableIndex, { x, y, width, height });
    });
  }, [kind, tableIndex, onLayout]);

  return (
    <View ref={ref} onLayout={report} style={style} collapsable={false}>
      {children}
    </View>
  );
}

function TableAreaComponent({
  table,
  trumpSuit,
  defendTargets = [],
  defendDragTargets = [],
  transferTargets = [],
  transferHighlight = false,
  onDropZoneLayout,
}: TableAreaProps) {
  const { w, h } = cardSize.table;
  const defendSet = new Set(defendTargets);
  const defendDragSet = new Set(defendDragTargets);
  const transferSet = new Set(transferTargets);

  return (
    <View style={styles.container}>
      {table.map((pair, i) => {
        const showTransfer = transferSet.has(i) && !pair.defense;
        const showDefendHint = defendSet.has(i) && !pair.defense;
        const defendDragActive = defendDragSet.has(i);
        const pairW = showTransfer ? w + TRANSFER_SLOT_W + 10 : w + 16;
        const pairH = h + 22 + (showDefendHint ? 10 : 0);

        return (
          <Animated.View
            key={pair.attack.id}
            entering={FadeIn.duration(180)}
            exiting={makeSweepOut(i * 55)}
            style={[styles.pair, { width: pairW, height: pairH }]}
          >
            <MeasuredSlot
              kind="defend"
              tableIndex={i}
              onLayout={onDropZoneLayout}
              style={[
                styles.attackSlot,
                { width: w, height: h },
                showDefendHint && styles.attackDefendable,
                defendDragActive && styles.attackDefendActive,
              ]}
            >
              <Card
                card={pair.attack}
                width={w}
                height={h}
                trump={pair.attack.suit === trumpSuit}
              />
              {showDefendHint && (
                <View
                  pointerEvents="none"
                  style={[styles.defendHint, defendDragActive && styles.defendHintActive]}
                >
                  <Text style={[styles.defendIcon, defendDragActive && styles.defendIconActive]}>
                    {"\u2191"}
                  </Text>
                  <Text style={[styles.defendLabel, defendDragActive && styles.defendLabelActive]}>
                    Beat
                  </Text>
                </View>
              )}
            </MeasuredSlot>

            {showTransfer && (
              <MeasuredSlot
                kind="transfer"
                tableIndex={i}
                onLayout={onDropZoneLayout}
                style={[
                  styles.transferSlot,
                  { width: TRANSFER_SLOT_W, height: h },
                  transferHighlight && styles.transferSlotActive,
                ]}
              >
                <Text style={[styles.transferIcon, transferHighlight && styles.transferIconActive]}>
                  {"\u21AA"}
                </Text>
                <Text style={styles.transferLabel}>Pass</Text>
              </MeasuredSlot>
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
    overflow: "visible",
  },
  attackDefendable: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.success,
  },
  attackDefendActive: {
    borderStyle: "solid",
    borderColor: colors.gold,
    backgroundColor: colors.feltEdge,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  defendHint: {
    position: "absolute",
    bottom: -10,
    left: 0,
    right: 0,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "center",
  },
  defendHintActive: {
    borderColor: colors.gold,
    backgroundColor: colors.feltEdge,
  },
  defendIcon: { fontSize: 11, color: colors.success, fontWeight: "800" },
  defendIconActive: { color: colors.gold },
  defendLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "800" },
  defendLabelActive: { color: colors.textLight },
  defense: { position: "absolute", top: 16, left: 14 },
  transferSlot: {
    position: "absolute",
    top: 0,
    right: 0,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.goldDim,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  transferSlotActive: {
    borderColor: colors.gold,
    backgroundColor: colors.feltEdge,
  },
  transferIcon: { fontSize: 22, color: colors.goldDim, fontWeight: "700" },
  transferIconActive: { color: colors.gold },
  transferLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "700" },
});

export const TableArea = React.memo(TableAreaComponent);
