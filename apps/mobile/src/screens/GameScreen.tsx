import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type Card as CardModel,
  type GameState,
  type PlayerId,
  undefendedCount,
} from "@durak/game-core";
import { Background } from "../components/Background";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DeckPile } from "../components/DeckPile";
import { Hand } from "../components/Hand";
import { PlayerSeat, type SeatRole } from "../components/PlayerSeat";
import { PotBadge } from "../components/PotBadge";
import { ReactionsBar } from "../components/ReactionsBar";
import { TableArea, type TableAreaHandle } from "../components/TableArea";
import { TurnTimer } from "../components/TurnTimer";
import { useGameStore } from "../game/store";
import { getHumanView, formatRulesLabel, opponentOrder } from "../game/selectors";
import {
  type DragCardBounds,
  type DropZone,
  type DropZoneKind,
  resolveDropFromBounds,
} from "../game/dropZones";
import { colors, radius, spacing, timing } from "../theme";

function activePlayer(game: GameState): PlayerId {
  if (!game.takeInProgress && undefendedCount(game) > 0) return game.defenderId;
  return game.attackerId;
}

function seatRole(game: GameState, id: PlayerId): SeatRole {
  if (id === game.defenderId) return "defender";
  if (id === game.attackerId) return "attacker";
  return null;
}

export function GameScreen() {
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const names = useGameStore((s) => s.names);
  const pot = useGameStore((s) => s.pot);
  const buyIn = useGameStore((s) => s.buyIn);
  const lastMoveAt = useGameStore((s) => s.lastMoveAt);
  const submitHuman = useGameStore((s) => s.submitHuman);
  const autoPlayHuman = useGameStore((s) => s.autoPlayHuman);
  const goHome = useGameStore((s) => s.goHome);
  const debugScenario = useGameStore((s) => s.debugScenario);
  const startBeatTransferDebug = useGameStore((s) => s.startBeatTransferDebug);

  const view = useMemo(() => (game ? getHumanView(game, humanId) : null), [game, humanId]);
  const isPerevodnoy = game?.rules.variant === "perevodnoy";
  /** Beat / pass drop zones only when perevodnoy offers a transfer choice. */
  const showTransferChoice = isPerevodnoy && Boolean(view?.canTransfer);

  const [remaining, setRemaining] = useState(timing.turnSeconds);
  const [takeConfirmOpen, setTakeConfirmOpen] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragBounds, setDragBounds] = useState<DragCardBounds | null>(null);
  const [hoverDrop, setHoverDrop] = useState<DropZone | null>(null);
  const [zoneRemeasureKey, setZoneRemeasureKey] = useState(0);
  const dropZonesRef = useRef<DropZone[]>([]);
  const lockedDropRef = useRef<DropZone | null>(null);
  const draggingCardIdRef = useRef<string | null>(null);
  const lastDragBoundsRef = useRef<DragCardBounds | null>(null);
  const pendingReaimRef = useRef(false);
  const tableAreaRef = useRef<TableAreaHandle>(null);
  const firedRef = useRef(false);

  // Stable across the timer's frequent re-renders so the hand never re-springs.
  const playableIds = useMemo(
    () =>
      new Set<string>([
        ...(view?.attackable.map((c) => c.id) ?? []),
        ...Object.keys(view?.defendable ?? {}),
        ...Object.keys(view?.transferable ?? {}),
      ]),
    [view],
  );

  const cardById = useCallback(
    (cardId: string): CardModel | undefined =>
      (game?.hands[humanId] ?? []).find((c) => c.id === cardId),
    [game, humanId],
  );

  const dropOptionsForCard = useCallback(
    (card: CardModel): { kinds: DropZoneKind[]; tableIndices: number[] } | null => {
      if (!view) return null;
      const beat = view.defendable[card.id] ?? [];
      const transfer = view.transferable[card.id] ?? [];
      const kinds: DropZoneKind[] = [];
      if (beat.length) kinds.push("defend");
      if (transfer.length) kinds.push("transfer");
      const tableIndices = [...new Set([...beat, ...transfer])];
      if (!kinds.length) return null;
      return { kinds, tableIndices };
    },
    [view],
  );

  const resolveZoneForCard = useCallback(
    (card: CardModel, bounds: DragCardBounds, commit = false): DropZone | null => {
      const options = dropOptionsForCard(card);
      if (!options) return null;
      const tableOverlap =
        options.kinds.includes("defend") && options.kinds.includes("transfer");
      const result = resolveDropFromBounds(
        bounds,
        dropZonesRef.current,
        { ...options, tableOverlap, commit },
        commit ? null : lockedDropRef.current,
      );
      if (!commit) lockedDropRef.current = result.locked;
      return result.zone;
    },
    [dropOptionsForCard],
  );

  const updateDragAim = useCallback(
    (bounds: DragCardBounds | null) => {
      setDragBounds(bounds);
      lastDragBoundsRef.current = bounds;
      const cardId = draggingCardIdRef.current;
      if (!bounds || !cardId) {
        lockedDropRef.current = null;
        setHoverDrop(null);
        return;
      }
      const card = cardById(cardId);
      setHoverDrop(card ? resolveZoneForCard(card, bounds) : null);
    },
    [cardById, resolveZoneForCard],
  );

  const transferTargets = useMemo(() => {
    if (!showTransferChoice) return [];
    const indices = new Set<number>();
    for (const targets of Object.values(view?.transferable ?? {})) {
      for (const t of targets) indices.add(t);
    }
    return [...indices];
  }, [showTransferChoice, view?.transferable]);

  const expectedZoneCount = showTransferChoice ? transferTargets.length * 2 : 0;

  const reaimFromLastBounds = useCallback(() => {
    const bounds = lastDragBoundsRef.current;
    const cardId = draggingCardIdRef.current;
    if (!bounds || !cardId) return;
    if (showTransferChoice && dropZonesRef.current.length < expectedZoneCount) {
      pendingReaimRef.current = true;
      return;
    }
    pendingReaimRef.current = false;
    const card = cardById(cardId);
    if (card) setHoverDrop(resolveZoneForCard(card, bounds));
  }, [cardById, resolveZoneForCard, showTransferChoice, expectedZoneCount]);

  const handleDragActive = useCallback((cardId: string | null) => {
    draggingCardIdRef.current = cardId;
    setDraggingCardId(cardId);
    if (!cardId) {
      lockedDropRef.current = null;
      lastDragBoundsRef.current = null;
      pendingReaimRef.current = false;
      setHoverDrop(null);
    }
  }, []);

  const handleDragBegin = useCallback(() => {
    lockedDropRef.current = null;
    if (showTransferChoice) {
      tableAreaRef.current?.remeasureZones();
    }
  }, [showTransferChoice]);

  const turnLabel = useMemo(() => {
    if (!view) return "Your move";
    if (view.isDefender) {
      if (showTransferChoice) return "Drag to beat or transfer";
      return "Defend";
    }
    if (view.mustOpen) return "Attack";
    return "Your move";
  }, [view, showTransferChoice]);

  useEffect(() => {
    if (!showTransferChoice) {
      dropZonesRef.current = [];
      lockedDropRef.current = null;
      draggingCardIdRef.current = null;
      lastDragBoundsRef.current = null;
      setDragBounds(null);
      setHoverDrop(null);
    }
  }, [showTransferChoice, game?.table.length]);

  useEffect(() => {
    if (showTransferChoice) {
      setZoneRemeasureKey((k) => k + 1);
    }
  }, [showTransferChoice, transferTargets, game?.table]);

  const onDropZoneLayout = useCallback(
    (zone: DropZone) => {
      const rest = dropZonesRef.current.filter(
        (z) => !(z.tableIndex === zone.tableIndex && z.kind === zone.kind),
      );
      dropZonesRef.current = [...rest, zone];
      if (pendingReaimRef.current || draggingCardIdRef.current) {
        reaimFromLastBounds();
      }
    },
    [reaimFromLastBounds],
  );

  const onDropZoneRemoved = useCallback(
    (tableIndex: number, kind: DropZoneKind) => {
      dropZonesRef.current = dropZonesRef.current.filter(
        (z) => !(z.tableIndex === tableIndex && z.kind === kind),
      );
      setHoverDrop((prev) =>
        prev?.tableIndex === tableIndex && prev.kind === kind ? null : prev,
      );
    },
    [],
  );

  const playCard = useCallback(
    (card: CardModel) => {
      if (!view) return;
      const targets = view.defendable[card.id];
      if (targets && targets.length > 0) {
        submitHuman({ type: "DEFEND", player: humanId, card, target: targets[0]! });
        return;
      }
      if (view.attackable.some((c) => c.id === card.id)) {
        submitHuman({ type: "ATTACK", player: humanId, card });
      }
    },
    [view, submitHuman, humanId],
  );

  const onDropAt = useCallback(
    (card: CardModel, bounds: DragCardBounds) => {
      if (!view) return;

      if (showTransferChoice) {
        const zone = resolveZoneForCard(card, bounds, true);
        lockedDropRef.current = null;
        setHoverDrop(null);

        if (zone?.kind === "transfer") {
          const targets = view.transferable[card.id];
          if (targets?.includes(zone.tableIndex)) {
            submitHuman({
              type: "TRANSFER",
              player: humanId,
              card,
              target: zone.tableIndex,
            });
            return;
          }
        }
        if (zone?.kind === "defend") {
          const targets = view.defendable[card.id];
          if (targets?.includes(zone.tableIndex)) {
            submitHuman({
              type: "DEFEND",
              player: humanId,
              card,
              target: zone.tableIndex,
            });
            return;
          }
        }
        return;
      }

      playCard(card);
    },
    [view, showTransferChoice, submitHuman, humanId, playCard, resolveZoneForCard],
  );

  const confirmTake = useCallback(() => {
    submitHuman({ type: "TAKE", player: humanId });
    setTakeConfirmOpen(false);
  }, [submitHuman, humanId]);

  useEffect(() => {
    if (!view?.canTake) setTakeConfirmOpen(false);
  }, [view?.canTake]);

  useEffect(() => {
    firedRef.current = false;
    if (debugScenario || !view?.mustAct) {
      setRemaining(timing.turnSeconds);
      return;
    }
    const start = lastMoveAt || Date.now();
    const tick = () => {
      const r = Math.max(0, timing.turnSeconds - (Date.now() - start) / 1000);
      setRemaining(r);
      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        autoPlayHuman();
      }
    };
    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [debugScenario, view?.mustAct, lastMoveAt, autoPlayHuman]);

  if (!game || !view) return null;

  const opponents = opponentOrder(game, humanId);
  const active = activePlayer(game);

  const humanHand = game.hands[humanId] ?? [];

  return (
    <Background>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View>
            <PotBadge pot={pot} buyIn={buyIn} />
            <Text style={styles.rulesBadge}>{formatRulesLabel(game)}</Text>
          </View>
          <View style={styles.headerActions}>
            {debugScenario && (
              <Pressable style={styles.restart} onPress={() => startBeatTransferDebug()} hitSlop={8}>
                <Text style={styles.restartText}>Restart</Text>
              </Pressable>
            )}
            <Pressable style={styles.exit} onPress={goHome} hitSlop={8}>
              <Text style={styles.exitText}>Exit</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.opponents}>
          {opponents.map((id) => (
            <PlayerSeat
              key={id}
              name={names[id] ?? id}
              cardCount={(game.hands[id] ?? []).length}
              role={seatRole(game, id)}
              active={active === id && game.phase === "playing"}
              finished={game.finishedOrder.includes(id)}
            />
          ))}
        </View>

        <View style={styles.middle}>
          <View style={styles.tableSlot}>
            <TableArea
              ref={tableAreaRef}
              table={game.table}
              trumpSuit={game.trumpSuit}
              transferTargets={transferTargets}
              hoverDefendIndex={hoverDrop?.kind === "defend" ? hoverDrop.tableIndex : null}
              hoverTransferIndex={hoverDrop?.kind === "transfer" ? hoverDrop.tableIndex : null}
              remeasureKey={zoneRemeasureKey}
              onDropZoneLayout={showTransferChoice ? onDropZoneLayout : undefined}
              onDropZoneRemoved={showTransferChoice ? onDropZoneRemoved : undefined}
            />
          </View>
          <View style={styles.deckSlot}>
            <DeckPile
              deckCount={game.deck.length}
              trumpCard={game.trumpCard}
              trumpSuit={game.trumpSuit}
            />
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.timerRow}>
            {view.mustAct && (
              <TurnTimer
                progress={remaining / timing.turnSeconds}
                seconds={remaining}
                label={turnLabel}
              />
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, !view.canTake && styles.actionDisabled]}
              disabled={!view.canTake}
              onPress={() => setTakeConfirmOpen(true)}
            >
              <Text style={styles.actionText}>Take</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.doneBtn, !view.canPass && styles.actionDisabled]}
              disabled={!view.canPass}
              onPress={() => submitHuman({ type: "PASS", player: humanId })}
            >
              <Text style={[styles.actionText, styles.doneText]}>Done</Text>
            </Pressable>
          </View>

          <Hand
            cards={humanHand}
            playableIds={playableIds}
            interactive={view.mustAct}
            trumpSuit={game.trumpSuit}
            onPlay={playCard}
            onDropAt={onDropAt}
            onDragMove={showTransferChoice ? updateDragAim : undefined}
            onDragBegin={showTransferChoice ? handleDragBegin : undefined}
            onDragActive={handleDragActive}
          />

          <View style={styles.reactions}>
            <ReactionsBar />
          </View>
        </View>
      </SafeAreaView>

      <ConfirmDialog
        visible={takeConfirmOpen}
        title="Take all cards?"
        message="You couldn't beat the attack. Are you sure you want to pick up every card on the table?"
        confirmLabel="Take"
        cancelLabel="Cancel"
        onConfirm={confirmTake}
        onCancel={() => setTakeConfirmOpen(false)}
      />
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  restart: {
    backgroundColor: "rgba(70, 167, 88, 0.2)",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.success,
  },
  restartText: { color: colors.success, fontWeight: "700" },
  exit: {
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  exitText: { color: colors.textLight, fontWeight: "700" },
  rulesBadge: { color: colors.textMuted, fontSize: 10, fontWeight: "600", marginTop: 2 },
  opponents: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  middle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  // Play area takes remaining width so pairs never sit under the deck column.
  tableSlot: {
    flex: 1,
    justifyContent: "center",
  },
  deckSlot: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: spacing.md,
  },
  bottom: { paddingBottom: spacing.xs, overflow: "visible" },
  timerRow: { height: 38, alignItems: "center", justifyContent: "center" },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    backgroundColor: colors.danger,
    paddingVertical: 9,
    paddingHorizontal: 26,
    borderRadius: radius.pill,
  },
  doneBtn: { backgroundColor: colors.gold },
  actionDisabled: { opacity: 0.3 },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  doneText: { color: colors.feltBottom },
  reactions: { alignItems: "center", marginTop: spacing.xs, overflow: "visible", zIndex: 20 },
});
