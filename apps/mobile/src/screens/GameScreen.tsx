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
import { AbilityDock } from "../components/AbilityDock";
import { GraveyardSheet } from "../components/GraveyardSheet";
import { RevealSheet } from "../components/RevealSheet";
import { ReactionsBar } from "../components/ReactionsBar";
import { Hand } from "../components/Hand";
import { PlayerSeat } from "../components/PlayerSeat";
import { PotBadge } from "../components/PotBadge";
import {
  TableArea,
  type TableAreaHandle,
  type TableExitKind,
} from "../components/TableArea";
import { TurnTimer } from "../components/TurnTimer";
import { useGameStore } from "../game/store";
import {
  canReveal,
  getHumanView,
  getSeatRole,
  opponentOrder,
  getBeatTransferChoice,
  revealEligibleOpponents,
} from "../game/selectors";
import {
  type DragCardBounds,
  type DropZone,
  type DropZoneKind,
  resolveDropFromBounds,
} from "../game/dropZones";
import { colors, radius, shadows, spacing, timing, typography } from "../theme";
import { trigger } from "../feedback/haptics";

const TABLE_EXIT_RESET_MS = 450;

function activePlayer(game: GameState): PlayerId {
  if (!game.takeInProgress && undefendedCount(game) > 0) return game.defenderId;
  return game.attackerId;
}

function seatRoleForFinished(
  game: GameState,
  id: PlayerId,
): ReturnType<typeof getSeatRole> {
  if (game.finishedOrder.includes(id)) return null;
  return getSeatRole(game, id);
}

export interface GameScreenProps {
  onOpenSettings?: () => void;
}

export function GameScreen({ onOpenSettings }: GameScreenProps = {}) {
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const names = useGameStore((s) => s.names);
  const pot = useGameStore((s) => s.pot);
  const buyIn = useGameStore((s) => s.buyIn);
  const lastMoveAt = useGameStore((s) => s.lastMoveAt);
  const submitHuman = useGameStore((s) => s.submitHuman);
  const autoPlayHuman = useGameStore((s) => s.autoPlayHuman);
  const goHome = useGameStore((s) => s.goHome);
  const pauseForOverlay = useGameStore((s) => s.pauseForOverlay);
  const resumeFromOverlay = useGameStore((s) => s.resumeFromOverlay);

  const view = useMemo(() => (game ? getHumanView(game, humanId) : null), [game, humanId]);
  const beatTransferChoice = useMemo(
    () => (game && view ? getBeatTransferChoice(game, view) : { active: false, choiceIndices: [], transferIndices: [] }),
    [game, view],
  );
  /** Dual beat/transfer slot signs on the table (Perevodnoy opening defend). */
  const showBeatTransferChoice = beatTransferChoice.active;

  const [remaining, setRemaining] = useState(timing.turnSeconds);
  const [takeConfirmOpen, setTakeConfirmOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [tableExitKind, setTableExitKind] = useState<TableExitKind>("toDiscard");
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
  const prevRemainingRef = useRef(timing.turnSeconds);
  const prevGameRef = useRef<GameState | null>(null);
  const exitResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleExitKindReset = useCallback(() => {
    if (exitResetTimerRef.current) clearTimeout(exitResetTimerRef.current);
    exitResetTimerRef.current = setTimeout(() => {
      exitResetTimerRef.current = null;
      setTableExitKind("toDiscard");
    }, TABLE_EXIT_RESET_MS);
  }, []);

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

  const transferTargets = beatTransferChoice.transferIndices;

  const expectedZoneCount =
    beatTransferChoice.choiceIndices.length + beatTransferChoice.transferIndices.length;

  const reaimFromLastBounds = useCallback(() => {
    const bounds = lastDragBoundsRef.current;
    const cardId = draggingCardIdRef.current;
    if (!bounds || !cardId) return;
    if (showBeatTransferChoice && dropZonesRef.current.length < expectedZoneCount) {
      pendingReaimRef.current = true;
      return;
    }
    pendingReaimRef.current = false;
    const card = cardById(cardId);
    if (card) setHoverDrop(resolveZoneForCard(card, bounds));
  }, [cardById, resolveZoneForCard, showBeatTransferChoice, expectedZoneCount]);

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
    if (showBeatTransferChoice) {
      tableAreaRef.current?.remeasureZones();
    }
  }, [showBeatTransferChoice]);

  const turnLabel = useMemo(() => {
    if (!view || !game) return "Your move";
    if (game.takeInProgress) {
      if (view.isDefender) return "Taking cards…";
      if (view.attackable.length > 0) return "Throw in";
      return "Waiting…";
    }
    if (view.isDefender) {
      if (showBeatTransferChoice) {
        return transferTargets.length > 0 ? "Drag to beat or transfer" : "Drag to beat";
      }
      return "Defend";
    }
    if (view.mustOpen) return "Attack";
    return "Your move";
  }, [view, game, showBeatTransferChoice, transferTargets.length]);

  useEffect(() => {
    if (!showBeatTransferChoice) {
      dropZonesRef.current = [];
      lockedDropRef.current = null;
      draggingCardIdRef.current = null;
      lastDragBoundsRef.current = null;
      setDragBounds(null);
      setHoverDrop(null);
    }
  }, [showBeatTransferChoice, game?.table.length]);

  useEffect(() => {
    if (showBeatTransferChoice) {
      setZoneRemeasureKey((k) => k + 1);
    }
  }, [showBeatTransferChoice, beatTransferChoice.choiceIndices, beatTransferChoice.transferIndices, game?.table]);

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

      if (showBeatTransferChoice) {
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
    [view, showBeatTransferChoice, submitHuman, humanId, playCard, resolveZoneForCard],
  );

  const confirmTake = useCallback(() => {
    setTableExitKind("toHand");
    submitHuman({ type: "TAKE", player: humanId });
    setTakeConfirmOpen(false);
  }, [submitHuman, humanId]);

  useEffect(() => {
    if (!game) {
      prevGameRef.current = null;
      return;
    }

    const prev = prevGameRef.current;
    if (prev) {
      if (prev.table.length > 0 && game.table.length === 0) {
        const kind: TableExitKind = prev.takeInProgress
          ? prev.defenderId === humanId
            ? "toHand"
            : "toOpponent"
          : "toDiscard";
        setTableExitKind(kind);
        scheduleExitKindReset();
      } else if (
        !prev.takeInProgress &&
        game.takeInProgress &&
        game.defenderId !== humanId
      ) {
        setTableExitKind("toOpponent");
      }
    }

    prevGameRef.current = game;
  }, [game, humanId, scheduleExitKindReset]);

  useEffect(
    () => () => {
      if (exitResetTimerRef.current) clearTimeout(exitResetTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!view?.canTake) setTakeConfirmOpen(false);
  }, [view?.canTake]);

  useEffect(() => {
    firedRef.current = false;
    prevRemainingRef.current = timing.turnSeconds;
    // Beat/transfer choice needs a deliberate drag — no timer auto-play.
    if (!view?.mustAct || showBeatTransferChoice || revealOpen) {
      setRemaining(timing.turnSeconds);
      return;
    }
    const start = lastMoveAt || Date.now();
    const tick = () => {
      const r = Math.max(0, timing.turnSeconds - (Date.now() - start) / 1000);
      const prevR = prevRemainingRef.current;
      if (prevR > 4 && r <= 4) trigger("timerWarning");
      if (prevR > 1 && r <= 1) trigger("timerCritical");
      setRemaining(r);
      prevRemainingRef.current = r;
      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        trigger("timerExpired");
        autoPlayHuman();
      }
    };
    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [view?.mustAct, showBeatTransferChoice, revealOpen, lastMoveAt, autoPlayHuman]);

  const revealEnabled = game && view ? canReveal(game, humanId, view) : false;
  const revealOpponents = useMemo(() => {
    if (!game || !revealOpen) return [];
    return revealEligibleOpponents(game, humanId).map((id) => ({
      id,
      name: names[id] ?? id,
      cards: game.hands[id] ?? [],
    }));
  }, [game, humanId, names, revealOpen]);

  const openReveal = useCallback(() => {
    if (!revealEnabled) return;
    pauseForOverlay();
    setRevealOpen(true);
  }, [revealEnabled, pauseForOverlay]);

  const closeReveal = useCallback(() => {
    setRevealOpen(false);
    resumeFromOverlay();
  }, [resumeFromOverlay]);

  if (!game || !view) return null;

  const opponents = opponentOrder(game, humanId);
  const active = activePlayer(game);

  const humanHand = game.hands[humanId] ?? [];
  const abilitiesMode = game.rules.playStyle === "abilities";

  return (
    <Background variant="game">
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <PotBadge pot={pot} buyIn={buyIn} />
          </View>

          <View style={styles.headerActions}>
            {onOpenSettings && (
              <Pressable style={styles.headerBtn} onPress={onOpenSettings} hitSlop={10}>
                <Text style={styles.headerBtnText}>⚙</Text>
              </Pressable>
            )}
            <Pressable style={styles.headerBtn} onPress={goHome} hitSlop={10}>
              <Text style={styles.headerBtnText}>✕</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.opponents}>
          {opponents.map((id) => {
            const role = seatRoleForFinished(game, id);
            return (
            <PlayerSeat
              key={id}
              name={names[id] ?? id}
              cardCount={(game.hands[id] ?? []).length}
              role={role}
              active={active === id && game.phase === "playing"}
              finished={game.finishedOrder.includes(id)}
            />
            );
          })}
        </View>

        <View style={styles.middle}>
          {/* Felt surface — visual grounding for the play area */}
          <View style={styles.tableSlot}>
            <TableArea
              ref={tableAreaRef}
              table={game.table}
              trumpSuit={game.trumpSuit}
              exitKind={tableExitKind}
              choiceTargets={beatTransferChoice.choiceIndices}
              transferTargets={transferTargets}
              hoverDefendIndex={hoverDrop?.kind === "defend" ? hoverDrop.tableIndex : null}
              hoverTransferIndex={hoverDrop?.kind === "transfer" ? hoverDrop.tableIndex : null}
              dragActive={showBeatTransferChoice && !!draggingCardId}
              remeasureKey={zoneRemeasureKey}
              onDropZoneLayout={showBeatTransferChoice ? onDropZoneLayout : undefined}
              onDropZoneRemoved={showBeatTransferChoice ? onDropZoneRemoved : undefined}
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
              style={[styles.actionBtn, styles.takeBtn, !view.canTake && styles.actionDisabled]}
              disabled={!view.canTake}
              onPress={() => {
                trigger("uiTap");
                setTakeConfirmOpen(true);
              }}
            >
              <Text style={styles.actionText}>TAKE</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.doneBtn, !view.canPass && styles.actionDisabled]}
              disabled={!view.canPass}
              onPress={() => submitHuman({ type: "PASS", player: humanId })}
            >
              <Text style={[styles.actionText, styles.doneText]}>DONE</Text>
            </Pressable>
          </View>

          <View style={styles.utilityRow}>
            <ReactionsBar />
          </View>

          <Hand
            cards={humanHand}
            playableIds={playableIds}
            interactive={view.mustAct}
            trumpSuit={game.trumpSuit}
            onPlay={playCard}
            onDropAt={onDropAt}
            onDragMove={showBeatTransferChoice ? updateDragAim : undefined}
            onDragBegin={showBeatTransferChoice ? handleDragBegin : undefined}
            onDragActive={handleDragActive}
          />

          {abilitiesMode && (
            <View style={styles.abilitiesRow}>
              <AbilityDock
                discardCount={game.discard.length}
                canReveal={revealEnabled}
                onRevealPress={openReveal}
                onGraveyardPress={() => setGraveyardOpen(true)}
              />
            </View>
          )}
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

      {abilitiesMode && (
        <GraveyardSheet
          visible={graveyardOpen}
          onClose={() => setGraveyardOpen(false)}
          cards={game.discard}
          trumpSuit={game.trumpSuit}
        />
      )}

      {abilitiesMode && (
        <RevealSheet
          visible={revealOpen}
          onClose={closeReveal}
          trumpSuit={game.trumpSuit}
          opponents={revealOpponents}
        />
      )}
    </Background>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  headerLeft: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(231, 192, 103, 0.20)",
  },
  headerBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  opponents: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    overflow: "visible",
  },
  middle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  tableSlot: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: spacing.sm,
  },
  deckSlot: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: spacing.md,
  },
  bottom:    { paddingBottom: spacing.xs, overflow: "visible" },
  timerRow:  {
    height: 42,
    alignItems: "stretch",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  takeBtn: {
    backgroundColor: colors.danger,
    ...shadows.dangerGlow,
  },
  doneBtn: {
    backgroundColor: colors.gold,
    ...shadows.goldGlow,
  },
  actionDisabled: { opacity: 0.28 },
  actionText: {
    ...typography.caption,
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  doneText: { color: colors.feltBottom },
  utilityRow: {
    width: "100%",
    marginBottom: spacing.xs,
    overflow: "visible",
    zIndex: 20,
  },
  abilitiesRow: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    overflow: "visible",
  },
});
