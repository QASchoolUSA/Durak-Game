import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSharedValue } from "react-native-reanimated";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type Card as CardModel,
  type GameState,
  type PlayerId,
} from "@durak/game-core";
import { Background } from "../components/Background";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DeckPile, DECK_ANCHOR_ID } from "../components/DeckPile";
import { DealFlightOverlay } from "../components/DealFlightOverlay";
import { CardFlightOverlay } from "../components/CardFlightOverlay";
import type { AnchorRect } from "../components/MeasuredAnchor";
import { useDealAnimation } from "../hooks/useDealAnimation";
import { useTakeAnimation } from "../hooks/useTakeAnimation";
import { timeoutMoveFor } from "../game/autoMove";
import type { QueuedDealStep } from "../game/dealSequence";
import {
  isTableCardAnchorId,
  tableCardIdsFromPairs,
  type TakeSnapshot,
} from "../game/takeSequence";
import { AbilityDock } from "../components/AbilityDock";
import { GraveyardSheet } from "../components/GraveyardSheet";
import { PendingRevealOverlay } from "../components/PendingRevealOverlay";
import { RevealSheet } from "../components/RevealSheet";
import { GameMenuModal } from "../components/GameMenuModal";
import {
  ReactionsHost,
  type ReactionsHostRef,
} from "../components/ReactionsBar";
import { Hand, HAND_ANCHOR_ID } from "../components/Hand";
import { PlayerSeat, seatAnchorId } from "../components/PlayerSeat";
import { HumanPlayerChip } from "../components/HumanPlayerChip";
import { EconomyBar } from "../components/EconomyBar";
import { EconomyChip } from "../components/EconomyChip";
import { formatEconomyAmount } from "../components/economyFormat";
import {
  GRAVEYARD_GOLD_COST,
  REVEAL_GOLD_COST,
  canAffordGold,
} from "../game/goldEconomy";
import { sortHandForDisplay } from "../game/handSort";
import {
  TableArea,
  type TableAreaHandle,
  type TableExitKind,
} from "../components/TableArea";
import { GameCoachOverlay, type CoachStep } from "../components/GameCoachOverlay";
import { useTurnProgress } from "../hooks/useTurnProgressSV";
import { anySeatOnClock, seatOnClockOnline } from "../game/turnClockEngine";
import { toWorkletZones } from "../game/dropZoneWorklet";
import { computeTableLayout } from "../game/tableLayout";
import { useRenderCount } from "../dev/useRenderCount";
import { prewarmSounds } from "../feedback/sounds";
import { useGameStore } from "../game/store";
import { usePreferencesStore } from "../game/preferencesStore";
import {
  canReveal,
  getHumanView,
  getSeatIndication,
  getSeatRole,
  playerMustAct,
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
import { colors, radius, shadows, spacing, typography } from "../theme";
import { GameLayoutProvider } from "../theme/GameLayoutContext";
import { useGameLayout } from "../theme/useGameLayout";
import { useUiTheme } from "../theme/UiThemeContext";
import { trigger } from "../feedback/haptics";
import { useReduceMotion } from "../hooks/useReduceMotion";

const TABLE_EXIT_RESET_MS = 620;
const ROUND_CLEAR_DELAY_MS = 120;
const ONLINE_TIMER_DEFER_MS = 0;

const STANDARD_COACH_STEPS: CoachStep[] = [
  {
    title: "Play your cards",
    body: "When it's your turn, your seat glows and the timer ring counts down. Drag or tap a highlighted card to attack or defend.",
  },
  {
    title: "Take or pass",
    body: "As defender, beat every attack or press TAKE. Attackers press DONE when finished throwing in.",
  },
  {
    title: "Beat the clock",
    body: "Each turn is timed. If time runs out, you automatically Take (as defender) or press Done (as attacker). When opening the attack, your lowest card is played. Otherwise you must still play manually.",
  },
];

const ABILITIES_COACH_STEP: CoachStep = {
  title: "Abilities",
  body: "Return undoes your last play for 3 seconds. Graveyard shows discarded cards; Reveal lets you peek at an opponent's hand.",
};

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

function useStableHandCards(cards: CardModel[]): CardModel[] {
  const stableRef = useRef(cards);
  const idsRef = useRef("");
  const nextIds = cards.map((c) => c.id).join(",");
  if (idsRef.current !== nextIds) {
    idsRef.current = nextIds;
    stableRef.current = cards;
  }
  return stableRef.current;
}

export function GameScreen({ onOpenSettings }: GameScreenProps = {}) {
  useRenderCount("GameScreen");
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const names = useGameStore((s) => s.names);
  const onlineDisplayName = useGameStore((s) => s.onlineDisplayName);
  const pot = useGameStore((s) => s.pot);
  const goldBalance = useGameStore((s) => s.goldBalance);
  const creditBalance = useGameStore((s) => s.creditBalance);
  const trySpendGold = useGameStore((s) => s.trySpendGold);
  const rollbackGoldSpend = useGameStore((s) => s.rollbackGoldSpend);
  const syncGoldBalance = useGameStore((s) => s.syncGoldBalance);
  const setOnlineStatusMessage = useGameStore((s) => s.setOnlineStatusMessage);
  const lastMoveAt = useGameStore((s) => s.lastMoveAt);
  const submitHuman = useGameStore((s) => s.submitHuman);
  const autoPlayHuman = useGameStore((s) => s.autoPlayHuman);
  const playMode = useGameStore((s) => s.playMode);
  const pendingReveal = useGameStore((s) => s.pendingReveal);
  const clearPendingReveal = useGameStore((s) => s.clearPendingReveal);
  const submittingMove = useGameStore((s) => s.submittingMove);
  const returnSnapshot = useGameStore((s) => s.returnSnapshot);
  const returnExpiresAt = useGameStore((s) => s.returnExpiresAt);
  const goHome = useGameStore((s) => s.goHome);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const turnDeadlineAt = useGameStore((s) => s.turnDeadlineAt);
  const turnClockPlayerId = useGameStore((s) => s.turnClockPlayerId);
  const serverTurnSeconds = useGameStore((s) => s.turnTimerSeconds);
  const forfeit = useMutation(api.rooms.forfeit);
  const useGraveyardAbility = useMutation(api.rooms.useGraveyardAbility);
  const useRevealAbility = useMutation(api.rooms.useRevealAbility);
  const ui = useUiTheme();
  const insets = useSafeAreaInsets();
  const lay = useGameLayout();
  const reduceMotion = useReduceMotion();
  const pauseForOverlay = useGameStore((s) => s.pauseForOverlay);
  const resumeFromOverlay = useGameStore((s) => s.resumeFromOverlay);
  const turnSeconds = usePreferencesStore((s) => s.turnSeconds);
  const tutorialCompleted = usePreferencesStore((s) => s.tutorialCompleted);
  const setTutorialCompleted = usePreferencesStore((s) => s.setTutorialCompleted);
  const prefsHydrated = usePreferencesStore((s) => s.hydrated);

  const skipInitialTurnStartRef = useRef(playMode === "online");

  const coachSteps = useMemo(
    () =>
      game?.rules.playStyle === "abilities"
        ? [...STANDARD_COACH_STEPS, ABILITIES_COACH_STEP]
        : STANDARD_COACH_STEPS,
    [game?.rules.playStyle],
  );
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachStepIndex, setCoachStepIndex] = useState(0);

  useEffect(() => {
    if (!prefsHydrated || tutorialCompleted) {
      setCoachVisible(false);
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => {
      setCoachVisible(true);
      setCoachStepIndex(0);
    });
    return () => task.cancel();
  }, [prefsHydrated, tutorialCompleted]);

  const dismissCoach = useCallback(() => {
    setCoachVisible(false);
    setTutorialCompleted(true);
  }, [setTutorialCompleted]);

  const view = useMemo(() => (game ? getHumanView(game, humanId) : null), [game, humanId]);
  const beatTransferChoice = useMemo(
    () => (game && view ? getBeatTransferChoice(game, view) : { active: false, choiceIndices: [], transferIndices: [] }),
    [game, view],
  );
  /** Dual beat/transfer slot signs on the table (Perevodnoy opening defend). */
  const showBeatTransferChoice = beatTransferChoice.active;

  const [takeConfirmOpen, setTakeConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [tableExitKind, setTableExitKind] = useState<TableExitKind>("toDiscard");
  const [zoneRemeasureKey, setZoneRemeasureKey] = useState(0);
  const dropZonesRef = useRef<DropZone[]>([]);
  const dropZonesSV = useSharedValue(toWorkletZones([]));
  const dragActiveSV = useSharedValue(false);
  const hoverDefendIndexSV = useSharedValue(-1);
  const hoverTransferIndexSV = useSharedValue(-1);
  const hoverDropRef = useRef<DropZone | null>(null);
  const lockedDropRef = useRef<DropZone | null>(null);
  const draggingCardIdRef = useRef<string | null>(null);
  const lastDragBoundsRef = useRef<DragCardBounds | null>(null);
  const pendingReaimRef = useRef(false);
  const tableAreaRef = useRef<TableAreaHandle>(null);
  const reactionsRef = useRef<ReactionsHostRef>(null);
  const prevGameRef = useRef<GameState | null>(null);
  const tablePairCount = game?.table.length ?? 0;
  const exitResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMustActRef = useRef(false);
  const prevMustActForTimerRef = useRef(false);
  const [tableSlotSize, setTableSlotSize] = useState({ width: 0, height: 0 });
  const [anchors, setAnchors] = useState<Record<string, AnchorRect>>({});
  const freezeAnchorsRef = useRef(false);
  const tableCardAnchorsRef = useRef<Record<string, AnchorRect>>({});
  const pendingTakeSnapshotRef = useRef<TakeSnapshot | null>(null);

  const handleAnchorLayout = useCallback((anchorId: string, rect: AnchorRect) => {
    if (isTableCardAnchorId(anchorId)) {
      tableCardAnchorsRef.current = {
        ...tableCardAnchorsRef.current,
        [anchorId]: rect,
      };
    }
    if (freezeAnchorsRef.current) return;
    setAnchors((prev) => {
      const existing = prev[anchorId];
      if (
        existing &&
        existing.x === rect.x &&
        existing.y === rect.y &&
        existing.width === rect.width &&
        existing.height === rect.height
      ) {
        return prev;
      }
      return { ...prev, [anchorId]: rect };
    });
  }, []);

  const handleAnchorRemoved = useCallback((anchorId: string) => {
    setAnchors((prev) => {
      if (!(anchorId in prev)) return prev;
      const next = { ...prev };
      delete next[anchorId];
      return next;
    });
  }, []);

  const deckAnchor = anchors[DECK_ANCHOR_ID] ?? null;
  const handAnchor = anchors[HAND_ANCHOR_ID] ?? null;
  const seatAnchors = useMemo(() => {
    const out: Record<PlayerId, AnchorRect | undefined> = {};
    if (!game) return out;
    for (const p of game.players) {
      if (p === humanId) continue;
      out[p] = anchors[seatAnchorId(p)];
    }
    return out;
  }, [game, humanId, anchors]);

  const takeAnimation = useTakeAnimation({
    game,
    humanId,
    playMode: playMode === "online" ? "online" : "solo",
    reduceMotion,
    handAnchor,
    tableCardAnchorsRef,
    pendingTakeSnapshotRef,
  });

  const {
    takeInProgress,
    takeQueue,
    revealedTakenCardIds,
    suppressTableExit,
    handleTakeStepComplete,
    handleTakeComplete,
  } = takeAnimation;

  const dealAnimation = useDealAnimation({
    game,
    humanId,
    playMode: playMode === "online" ? "online" : "solo",
    reduceMotion,
    deckAnchor,
    handAnchor,
    seatAnchors,
    deferRefillOverlay: takeInProgress || takeQueue.length > 0,
  });

  const {
    dealingInProgress,
    dealKind,
    displayedHandCounts,
    displayedDeckCount,
    revealedHumanCardIds,
    dealQueue,
    frozenOrigins,
    handleStepComplete,
    handleDealComplete,
  } = dealAnimation;

  freezeAnchorsRef.current =
    frozenOrigins != null || dealQueue.length > 0 || takeQueue.length > 0;

  const handleStepCompleteRef = useRef(handleStepComplete);
  handleStepCompleteRef.current = handleStepComplete;
  const handleDealCompleteRef = useRef(handleDealComplete);
  handleDealCompleteRef.current = handleDealComplete;

  const handleDealSound = useCallback(() => {
    trigger("deal");
  }, []);

  const handleDealStepComplete = useCallback((step: QueuedDealStep) => {
    handleStepCompleteRef.current(step);
  }, []);

  const handleTakeCompleteStable = useCallback(() => {
    handleTakeComplete();
    tableCardAnchorsRef.current = {};
  }, [handleTakeComplete]);

  const handleDealCompleteStable = useCallback(() => {
    handleDealCompleteRef.current();
  }, []);

  const handleTakeSound = useCallback(() => {
    trigger("takeCards");
  }, []);

  const tableLayout = useMemo(
    () =>
      computeTableLayout({
        pairCount: game?.table.length ?? 0,
        slotWidth: tableSlotSize.width,
        slotHeight: tableSlotSize.height,
        hasTransferChoice: showBeatTransferChoice,
        baseCardW: lay.cardSizes.table.w,
        baseCardH: lay.cardSizes.table.h,
      }),
    [
      game?.table.length,
      tableSlotSize.width,
      tableSlotSize.height,
      showBeatTransferChoice,
      lay.cardSizes.table.w,
      lay.cardSizes.table.h,
    ],
  );

  const denseTable = (game?.table.length ?? 0) >= 4;

  const handleTableSlotLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      setTableSlotSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    },
    [],
  );

  const instantDeal = reduceMotion;

  const handleCardsDealt = useCallback(() => {
    if (instantDeal || dealKind != null) return;
    trigger("deal");
  }, [instantDeal, dealKind]);

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
    (
      card: CardModel,
    ): { kinds: DropZoneKind[]; tableIndices: number[]; tableOverlap: boolean } | null => {
      if (!view) return null;
      const beat = view.defendable[card.id] ?? [];
      const canXfer = (view.transferable[card.id] ?? []).length > 0;
      const kinds: DropZoneKind[] = [];
      if (beat.length) kinds.push("defend");
      if (canXfer) kinds.push("transfer");
      if (!kinds.length) return null;
      const tableIndices = [...new Set([...beat, ...(canXfer ? [0] : [])])];
      const tableOverlap = beat.includes(0) && canXfer;
      return { kinds, tableIndices, tableOverlap };
    },
    [view],
  );

  const resolveZoneForCard = useCallback(
    (card: CardModel, bounds: DragCardBounds, commit = false): DropZone | null => {
      const options = dropOptionsForCard(card);
      if (!options) return null;
      const result = resolveDropFromBounds(
        bounds,
        dropZonesRef.current,
        { kinds: options.kinds, tableIndices: options.tableIndices, tableOverlap: options.tableOverlap, commit },
        commit ? null : lockedDropRef.current,
      );
      if (!commit) lockedDropRef.current = result.locked;
      return result.zone;
    },
    [dropOptionsForCard],
  );

  const setHoverDropIfChanged = useCallback((zone: DropZone | null) => {
    const prev = hoverDropRef.current;
    if (prev?.kind === zone?.kind && prev?.tableIndex === zone?.tableIndex) return;
    hoverDropRef.current = zone;
    hoverDefendIndexSV.value = zone?.kind === "defend" ? zone.tableIndex : -1;
    hoverTransferIndexSV.value = zone?.kind === "transfer" ? zone.tableIndex : -1;
  }, [hoverDefendIndexSV, hoverTransferIndexSV]);

  const updateDragAim = useCallback(
    (bounds: DragCardBounds | null) => {
      lastDragBoundsRef.current = bounds;
      const cardId = draggingCardIdRef.current;
      if (!bounds || !cardId) {
        lockedDropRef.current = null;
        setHoverDropIfChanged(null);
        return;
      }
      const card = cardById(cardId);
      setHoverDropIfChanged(card ? resolveZoneForCard(card, bounds) : null);
    },
    [cardById, resolveZoneForCard, setHoverDropIfChanged],
  );

  const transferTargets = beatTransferChoice.transferIndices;

  const expectedZoneCount =
    beatTransferChoice.choiceIndices.length +
    (beatTransferChoice.transferIndices.length > 0 ? 1 : 0);

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
    if (card) setHoverDropIfChanged(resolveZoneForCard(card, bounds));
  }, [cardById, resolveZoneForCard, showBeatTransferChoice, expectedZoneCount, setHoverDropIfChanged]);

  const handleDragActive = useCallback((cardId: string | null) => {
    draggingCardIdRef.current = cardId;
    dragActiveSV.value = !!cardId;
    if (!cardId) {
      lockedDropRef.current = null;
      lastDragBoundsRef.current = null;
      pendingReaimRef.current = false;
      hoverDropRef.current = null;
      hoverDefendIndexSV.value = -1;
      hoverTransferIndexSV.value = -1;
    }
  }, [dragActiveSV, hoverDefendIndexSV, hoverTransferIndexSV]);

  const handleDragBegin = useCallback(() => {
    lockedDropRef.current = null;
    if (showBeatTransferChoice) {
      requestAnimationFrame(() => {
        tableAreaRef.current?.remeasureZones();
      });
    }
  }, [showBeatTransferChoice]);

  useEffect(() => {
    if (!showBeatTransferChoice) {
      dropZonesRef.current = [];
      lockedDropRef.current = null;
      draggingCardIdRef.current = null;
      lastDragBoundsRef.current = null;
      hoverDropRef.current = null;
      hoverDefendIndexSV.value = -1;
      hoverTransferIndexSV.value = -1;
      dropZonesRef.current = [];
      dropZonesSV.value = [];
      dragActiveSV.value = false;
    }
  }, [showBeatTransferChoice, tablePairCount, hoverDefendIndexSV, hoverTransferIndexSV, dropZonesSV, dragActiveSV]);

  useEffect(() => {
    if (showBeatTransferChoice) {
      setZoneRemeasureKey((k) => k + 1);
    }
  }, [
    showBeatTransferChoice,
    beatTransferChoice.choiceIndices.join(","),
    beatTransferChoice.transferIndices.join(","),
    tablePairCount,
  ]);

  useEffect(() => {
    setZoneRemeasureKey((k) => k + 1);
  }, [tableLayout.scale, lay.cardSizes.table.w, lay.cardSizes.hand.w]);

  const onDropZoneLayout = useCallback(
    (zone: DropZone) => {
      const rest = dropZonesRef.current.filter(
        (z) => !(z.tableIndex === zone.tableIndex && z.kind === zone.kind),
      );
      dropZonesRef.current = [...rest, zone];
      dropZonesSV.value = toWorkletZones(dropZonesRef.current);
      if (pendingReaimRef.current || draggingCardIdRef.current) {
        reaimFromLastBounds();
      }
    },
    [reaimFromLastBounds, dropZonesSV],
  );

  const onDropZoneRemoved = useCallback(
    (tableIndex: number, kind: DropZoneKind) => {
      dropZonesRef.current = dropZonesRef.current.filter(
        (z) => !(z.tableIndex === tableIndex && z.kind === kind),
      );
      dropZonesSV.value = toWorkletZones(dropZonesRef.current);
      if (
        hoverDropRef.current?.tableIndex === tableIndex &&
        hoverDropRef.current.kind === kind
      ) {
        setHoverDropIfChanged(null);
      }
    },
    [dropZonesSV, setHoverDropIfChanged],
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
        const transferIdx = hoverTransferIndexSV.value;
        const defendIdx = hoverDefendIndexSV.value;
        const zone = resolveZoneForCard(card, bounds, true);
        lockedDropRef.current = null;

        const tryTransfer = (tableIndex: number) => {
          const targets = view.transferable[card.id];
          if (!targets?.includes(tableIndex)) return false;
          submitHuman({
            type: "TRANSFER",
            player: humanId,
            card,
            target: tableIndex,
          });
          return true;
        };

        const tryDefend = (tableIndex: number) => {
          const targets = view.defendable[card.id];
          if (!targets?.includes(tableIndex)) return false;
          submitHuman({
            type: "DEFEND",
            player: humanId,
            card,
            target: tableIndex,
          });
          return true;
        };

        let submitted = false;
        if (zone?.kind === "transfer") {
          submitted = tryTransfer(zone.tableIndex);
        } else if (zone?.kind === "defend") {
          submitted = tryDefend(zone.tableIndex);
        }

        if (!submitted && transferIdx >= 0) {
          submitted = tryTransfer(transferIdx);
        }
        if (!submitted && defendIdx >= 0) {
          submitted = tryDefend(defendIdx);
        }

        if (!submitted) {
          const xferTargets = view.transferable[card.id];
          const defendTargets = view.defendable[card.id];
          if (xferTargets?.length && !defendTargets?.length) {
            submitted = tryTransfer(xferTargets[0]!);
          }
        }

        setHoverDropIfChanged(null);
        return;
      }

      playCard(card);
    },
    [
      view,
      showBeatTransferChoice,
      submitHuman,
      humanId,
      playCard,
      resolveZoneForCard,
      setHoverDropIfChanged,
      hoverTransferIndexSV,
      hoverDefendIndexSV,
    ],
  );

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void prewarmSounds();
    });
    return () => task.cancel();
  }, []);

  const confirmTake = useCallback(() => {
    if (game) {
      pendingTakeSnapshotRef.current = {
        cardIds: tableCardIdsFromPairs(game.table),
        anchors: { ...tableCardAnchorsRef.current },
      };
    }
    setTableExitKind("toHand");
    submitHuman({ type: "TAKE", player: humanId });
    setTakeConfirmOpen(false);
  }, [submitHuman, humanId, game]);

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
        if (!prev.takeInProgress) {
          if (roundClearTimerRef.current) clearTimeout(roundClearTimerRef.current);
          roundClearTimerRef.current = setTimeout(() => {
            roundClearTimerRef.current = null;
            trigger("roundClear");
          }, ROUND_CLEAR_DELAY_MS);
        }
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
      if (roundClearTimerRef.current) clearTimeout(roundClearTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!view) return;
    const blocked = showBeatTransferChoice || revealOpen;
    const mustAct = view.mustAct && !blocked;
    const prev = prevMustActRef.current;
    if (view.mustAct && !prevMustActForTimerRef.current && playMode === "solo") {
      useGameStore.setState({ lastMoveAt: Date.now() });
    }
    prevMustActForTimerRef.current = view.mustAct;
    if (mustAct && !prev) {
      if (playMode === "online" && skipInitialTurnStartRef.current) {
        skipInitialTurnStartRef.current = false;
      } else {
        trigger("turnStart");
      }
    }
    prevMustActRef.current = mustAct;
  }, [view?.mustAct, showBeatTransferChoice, revealOpen, playMode]);

  useEffect(() => {
    if (!view?.canTake) setTakeConfirmOpen(false);
  }, [view?.canTake]);

  const effectiveTurnSeconds =
    playMode === "online" ? serverTurnSeconds : turnSeconds;
  const timerEnabled = effectiveTurnSeconds > 0;

  const opponentsForClock = game ? opponentOrder(game, humanId) : [];

  const seatOnClock = useMemo(() => {
    if (playMode === "online") {
      return turnClockPlayerId != null;
    }
    return anySeatOnClock(
      game,
      humanId,
      Boolean(view?.mustAct),
      opponentsForClock,
    );
  }, [playMode, turnClockPlayerId, game, humanId, view?.mustAct, opponentsForClock]);

  const handleTimeoutAutoPlay = useCallback(() => {
    if (game) {
      const move = timeoutMoveFor(game, humanId);
      if (move?.type === "TAKE") {
        pendingTakeSnapshotRef.current = {
          cardIds: tableCardIdsFromPairs(game.table),
          anchors: { ...tableCardAnchorsRef.current },
        };
      }
    }
    autoPlayHuman();
  }, [game, humanId, autoPlayHuman]);

  const timerClock = useMemo(
    () => ({
      enabled:
        timerEnabled &&
        seatOnClock &&
        !revealOpen &&
        !(pendingReveal != null && pendingReveal.expiresAt > Date.now()),
      totalSeconds: effectiveTurnSeconds,
      lastMoveAt,
      turnDeadlineAt,
      playMode,
      frameDeferMs: playMode === "online" ? ONLINE_TIMER_DEFER_MS : 0,
      onTimeout: handleTimeoutAutoPlay,
    }),
    [
      timerEnabled,
      effectiveTurnSeconds,
      seatOnClock,
      revealOpen,
      pendingReveal,
      lastMoveAt,
      turnDeadlineAt,
      playMode,
      handleTimeoutAutoPlay,
    ],
  );

  const turnProgress = useTurnProgress(timerClock);

  const humanHand = useStableHandCards(game?.hands[humanId] ?? []);
  const abilitiesMode = game?.rules.playStyle === "abilities";

  const revealEnabled = game ? canReveal(game, humanId) : false;
  const revealOpponents = useMemo(() => {
    if (!game || !revealOpen) return [];
    return revealEligibleOpponents(game, humanId).map((id) => {
      const hand = game.hands[id] ?? [];
      const cards =
        playMode === "online"
          ? hand.map((_, i) => ({
              id: `reveal-${id}-${i}`,
              suit: "spades" as const,
              rank: 6 as const,
            }))
          : hand;
      return { id, name: names[id] ?? id, cards };
    });
  }, [game, humanId, names, revealOpen, playMode]);

  const openGraveyard = useCallback(async () => {
    if (!abilitiesMode) {
      if (!canAffordGold(goldBalance, GRAVEYARD_GOLD_COST)) {
        setOnlineStatusMessage("Not enough gold.");
        trigger("error");
        return;
      }

      if (playMode === "online") {
        if (!onlineRoomId) return;
        try {
          const result = await useGraveyardAbility({
            roomId: onlineRoomId as Id<"rooms">,
          });
          syncGoldBalance(result.goldBalance);
        } catch {
          trigger("error");
          setOnlineStatusMessage("Not enough gold.");
          return;
        }
      } else if (!trySpendGold(GRAVEYARD_GOLD_COST)) {
        trigger("error");
        setOnlineStatusMessage("Not enough gold.");
        return;
      }
    }

    pauseForOverlay();
    setGraveyardOpen(true);
  }, [
    abilitiesMode,
    goldBalance,
    playMode,
    onlineRoomId,
    useGraveyardAbility,
    syncGoldBalance,
    trySpendGold,
    pauseForOverlay,
    setOnlineStatusMessage,
  ]);

  const openReveal = useCallback(() => {
    if (!revealEnabled) return;

    if (
      !abilitiesMode &&
      !canAffordGold(goldBalance, REVEAL_GOLD_COST)
    ) {
      setOnlineStatusMessage("Not enough gold.");
      return;
    }
    pauseForOverlay();
    setRevealOpen(true);
  }, [
    revealEnabled,
    abilitiesMode,
    goldBalance,
    pauseForOverlay,
    setOnlineStatusMessage,
  ]);

  const handleRevealCard = useCallback(
    async (opponentId: string, cardIndex: number) => {
      if (playMode === "online") {
        if (!onlineRoomId) return null;
        try {
          const result = await useRevealAbility({
            roomId: onlineRoomId as Id<"rooms">,
            opponentId,
            cardIndex,
          });
          syncGoldBalance(result.goldBalance);
          return result.card;
        } catch {
          trigger("error");
          setOnlineStatusMessage("Reveal failed.");
          return null;
        }
      }

      if (
        !abilitiesMode &&
        !trySpendGold(REVEAL_GOLD_COST)
      ) {
        trigger("error");
        setOnlineStatusMessage("Not enough gold.");
        return null;
      }

      const hand = game?.hands[opponentId as PlayerId] ?? [];
      const sorted = sortHandForDisplay(hand, game!.trumpSuit);
      const card = sorted[cardIndex] ?? null;
      if (!card) {
        if (!abilitiesMode) {
          rollbackGoldSpend(REVEAL_GOLD_COST);
        }
        return null;
      }
      return card;
    },
    [
      playMode,
      abilitiesMode,
      onlineRoomId,
      useRevealAbility,
      syncGoldBalance,
      trySpendGold,
      rollbackGoldSpend,
      game,
      setOnlineStatusMessage,
    ],
  );

  const closeReveal = useCallback(() => {
    setRevealOpen(false);
    resumeFromOverlay();
  }, [resumeFromOverlay]);

  const handleExit = useCallback(async () => {
    if (playMode === "online" && onlineRoomId) {
      try {
        await forfeit({
          roomId: onlineRoomId as Id<"rooms">,
        });
      } catch {
        /* room may already be gone */
      }
    }
    goHome();
  }, [playMode, onlineRoomId, forfeit, goHome]);
  const handleMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);

  if (!game || !view) {
    if (playMode === "online") {
      return (
        <Background variant="game">
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        </Background>
      );
    }
    return null;
  }

  const opponents = opponentOrder(game, humanId);
  const humanFinished = game.finishedOrder.includes(humanId);
  const humanOnClock =
    playMode === "online"
      ? seatOnClockOnline(turnClockPlayerId, humanId) &&
        game.phase === "playing" &&
        !humanFinished
      : playerMustAct(game, humanId) && !humanFinished;

  const goldAbilitiesEnabled = !abilitiesMode && game.phase === "playing";
  const returnWindowActive =
    playMode === "online"
      ? returnExpiresAt > Date.now()
      : !!returnSnapshot && returnExpiresAt > Date.now();
  const showAbilityDock =
    game.phase === "playing" &&
    (abilitiesMode || goldAbilitiesEnabled || returnWindowActive);
  const dockCanReveal =
    revealEnabled &&
    (abilitiesMode || canAffordGold(goldBalance, REVEAL_GOLD_COST));
  const dockCanGraveyard =
    abilitiesMode || canAffordGold(goldBalance, GRAVEYARD_GOLD_COST);
  const handInteractive =
    Boolean(view?.mustAct) && !submittingMove && !dealingInProgress && !takeInProgress;
  const humanIndication = humanOnClock
    ? (getSeatIndication(game, humanId, {
        mustAct: view?.mustAct,
        isDefender: view?.isDefender,
      }) ??
      (view?.isDefender || getSeatRole(game, humanId) === "defender"
        ? "defend"
        : "play"))
    : getSeatRole(game, humanId) === "taking"
      ? "defend"
      : null;

  return (
    <Background variant="game">
      {Platform.OS === "ios" && <StatusBar hidden />}
      <GameLayoutProvider>
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View
          style={[
            styles.gameColumn,
            {
              maxWidth: lay.isTablet ? lay.maxContent : undefined,
              paddingHorizontal: lay.hPad,
            },
          ]}
        >

        <View style={[styles.header, { position: "relative", paddingHorizontal: 0, paddingTop: Math.max(insets.top + 5, 30), alignItems: "flex-start" }]}>
          <View style={styles.headerLeft}>
            <EconomyBar
              variant="game"
              creditBalance={creditBalance}
              goldBalance={goldBalance}
            />
          </View>

          <View style={[StyleSheet.absoluteFill, { alignItems: "center", top: Math.max(insets.top + 5, 30), zIndex: 10 }]} pointerEvents="box-none">
            <View style={{ backgroundColor: ui.panelBg, borderRadius: radius.pill, borderWidth: 1, borderColor: ui.panelBorderSoft, paddingHorizontal: 3, paddingVertical: 2 }}>
              <EconomyChip
                icon="◆"
                value={formatEconomyAmount(pot)}
                valueColor={ui.accent}
                accessibilityLabel={`Pot ${pot.toLocaleString("en-US")}`}
                iconWellStyle={{
                  backgroundColor: ui.accentSoft,
                  borderColor: ui.accent,
                }}
              />
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.headerBtn,
                {
                  backgroundColor: ui.panelBg,
                  borderColor: ui.panelBorderSoft,
                  flexDirection: "row",
                  width: "auto",
                  paddingHorizontal: 16,
                  gap: spacing.sm,
                },
              ]}
              onPress={handleMenu}
              hitSlop={10}
            >
              <Text style={[styles.headerBtnText, { color: ui.textPrimary }]}>☰</Text>
              <Text style={[styles.headerBtnText, { color: ui.textPrimary, fontSize: 13, fontWeight: "700" }]}>Menu</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.opponents,
            denseTable && styles.opponentsDense,
            {
              paddingHorizontal: 0,
              paddingTop: denseTable ? 2 : lay.s(spacing.sm),
              paddingBottom: denseTable ? lay.s(spacing.xs) : lay.s(spacing.lg),
              marginTop: Math.max(insets.top - 10, 0),
              gap: lay.s(spacing.sm),
            },
          ]}
        >
          {opponents.map((id) => {
            const role = seatRoleForFinished(game, id);
            const oppFinished = game.finishedOrder.includes(id);
            const oppOnClock =
              playMode === "online"
                ? seatOnClockOnline(turnClockPlayerId, id) &&
                  game.phase === "playing" &&
                  !oppFinished
                : playerMustAct(game, id) && !oppFinished;
            const oppIndication = oppOnClock
              ? (getSeatIndication(game, id) ??
                (role === "defender" || role === "taking" ? "defend" : "play"))
              : role === "taking"
                ? "defend"
                : null;
            return (
            <PlayerSeat
              key={id}
              playerId={id}
              name={names[id] ?? id}
              cardCount={displayedHandCounts[id] ?? (game.hands[id] ?? []).length}
              role={role}
              indication={oppIndication}
              onClock={oppOnClock}
              turnProgress={turnProgress}
              timerEnabled={timerEnabled}
              finished={oppFinished}
              skipEnterAnimation={dealKind === "initial"}
              onSeatAnchorLayout={handleAnchorLayout}
              onSeatAnchorRemoved={handleAnchorRemoved}
            />
            );
          })}
        </View>

        <View style={styles.middle}>
          {/* Felt surface — visual grounding for the play area */}
          <View
            style={[
              styles.tableSlot,
              denseTable && styles.tableSlotDense,
              { paddingLeft: lay.s(spacing.sm) },
            ]}
            onLayout={handleTableSlotLayout}
          >
            <TableArea
              ref={tableAreaRef}
              table={game.table}
              trumpSuit={game.trumpSuit}
              layout={tableLayout}
              exitKind={tableExitKind}
              suppressExitAnimation={suppressTableExit}
              choiceTargets={beatTransferChoice.choiceIndices}
              transferTargets={transferTargets}
              hoverDefendIndexSV={showBeatTransferChoice ? hoverDefendIndexSV : undefined}
              hoverTransferIndexSV={showBeatTransferChoice ? hoverTransferIndexSV : undefined}
              dragActiveSV={showBeatTransferChoice ? dragActiveSV : undefined}
              reduceMotion={reduceMotion}
              remeasureKey={zoneRemeasureKey}
              onTableCardAnchorLayout={handleAnchorLayout}
              onTableCardAnchorRemoved={handleAnchorRemoved}
              onDropZoneLayout={showBeatTransferChoice ? onDropZoneLayout : undefined}
              onDropZoneRemoved={showBeatTransferChoice ? onDropZoneRemoved : undefined}
            />
          </View>
          <View style={[styles.deckSlot, { paddingRight: lay.s(spacing.md) }]}>
            <DeckPile
              deckCount={displayedDeckCount}
              trumpCard={game.trumpCard}
              trumpSuit={game.trumpSuit}
              skipEnterAnimation={dealKind === "initial"}
              onDeckAnchorLayout={handleAnchorLayout}
              onDeckAnchorRemoved={handleAnchorRemoved}
            />
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.actionDockRow}>
            <Pressable
              style={[
                styles.actionBtn,
                styles.actionSide,
                styles.takeBtn,
                (!view.canTake || submittingMove) && styles.actionDisabled,
              ]}
              disabled={!view.canTake || submittingMove || dealingInProgress || takeInProgress}
              onPress={() => {
                trigger("uiTap");
                setTakeConfirmOpen(true);
              }}
            >
              <Text style={styles.actionText}>TAKE</Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionBtn,
                styles.actionSide,
                styles.doneBtn,
                (!view.canPass || submittingMove) && styles.actionDisabled,
              ]}
              disabled={!view.canPass || submittingMove || dealingInProgress || takeInProgress}
              onPress={() => submitHuman({ type: "PASS", player: humanId })}
            >
              <Text style={[styles.actionText, styles.doneText]}>DONE</Text>
            </Pressable>
          </View>

          <Hand
            cards={humanHand}
            playableIds={playableIds}
            interactive={handInteractive}
            trumpSuit={game.trumpSuit}
            instantDeal={instantDeal}
            dealOverlayMode={dealKind}
            takeOverlayActive={takeInProgress}
            dealingInProgress={dealingInProgress || takeInProgress}
            revealedCardIds={
              takeInProgress ? revealedTakenCardIds : revealedHumanCardIds
            }
            onHandAnchorLayout={handleAnchorLayout}
            onHandAnchorRemoved={handleAnchorRemoved}
            onPlay={playCard}
            onDropAt={onDropAt}
            onDragMove={showBeatTransferChoice ? updateDragAim : undefined}
            onDragBegin={showBeatTransferChoice ? handleDragBegin : undefined}
            onDragActive={handleDragActive}
            onCardsDealt={instantDeal ? undefined : handleCardsDealt}
            dropZonesSV={showBeatTransferChoice ? dropZonesSV : undefined}
            hoverDefendIndexSV={showBeatTransferChoice ? hoverDefendIndexSV : undefined}
            hoverTransferIndexSV={showBeatTransferChoice ? hoverTransferIndexSV : undefined}
          />

          {showAbilityDock && (
            <View style={styles.abilitiesRow}>
              <AbilityDock
                discardCount={game.discard.length}
                canReveal={dockCanReveal}
                canGraveyard={dockCanGraveyard}
                showRevealGraveyard={abilitiesMode || goldAbilitiesEnabled}
                chargeGold={goldAbilitiesEnabled}
                onRevealPress={openReveal}
                onGraveyardPress={() => void openGraveyard()}
              />
            </View>
          )}

          <View
            style={[
              styles.humanSeatRow,
              {
                paddingHorizontal: lay.s(spacing.xl),
                paddingBottom: Math.max(insets.bottom, lay.s(spacing.sm)),
              },
            ]}
          >
            <HumanPlayerChip
              playerId={humanId}
              name={names[humanId] ?? onlineDisplayName ?? "Player"}
              showYouLabel
              role={seatRoleForFinished(game, humanId)}
              indication={humanIndication}
              onClock={humanOnClock}
              turnProgress={turnProgress}
              timerEnabled={timerEnabled}
              timerRunning={timerClock.enabled}
              finished={humanFinished}
              onPress={() => {
                trigger("uiTap");
                reactionsRef.current?.open();
              }}
            />
          </View>
        </View>

        <ReactionsHost ref={reactionsRef} />

        {dealQueue.length > 0 && frozenOrigins && (
          <DealFlightOverlay
            queue={dealQueue}
            humanId={humanId}
            origins={frozenOrigins}
            onStepComplete={handleDealStepComplete}
            onComplete={handleDealCompleteStable}
            onDealSound={handleDealSound}
            playMode={playMode === "online" ? "online" : "solo"}
          />
        )}

        {takeQueue.length > 0 && (
          <CardFlightOverlay
            queue={takeQueue}
            onStepComplete={handleTakeStepComplete}
            onComplete={handleTakeCompleteStable}
            onFlightSound={handleTakeSound}
            soundMode={playMode === "online" ? "online" : "solo"}
          />
        )}
        </View>
      </SafeAreaView>
      </GameLayoutProvider>

      <ConfirmDialog
        visible={takeConfirmOpen}
        title="Take all cards?"
        message="You couldn't beat the attack. Are you sure you want to pick up every card on the table?"
        confirmLabel="Take"
        cancelLabel="Cancel"
        onConfirm={confirmTake}
        onCancel={() => setTakeConfirmOpen(false)}
      />

      <GameMenuModal
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenSettings={() => {
          setMenuOpen(false);
          onOpenSettings?.();
        }}
        onLeaveGame={() => {
          setMenuOpen(false);
          handleExit();
        }}
      />

      {(abilitiesMode || goldAbilitiesEnabled) && (
        <GraveyardSheet
          visible={graveyardOpen}
          onClose={() => setGraveyardOpen(false)}
          cards={game.discard}
          trumpSuit={game.trumpSuit}
        />
      )}

      {(abilitiesMode || goldAbilitiesEnabled) && (
        <RevealSheet
          visible={revealOpen}
          onClose={closeReveal}
          onRevealCard={handleRevealCard}
          trumpSuit={game.trumpSuit}
          opponents={revealOpponents}
        />
      )}

      <PendingRevealOverlay
        card={pendingReveal?.card ?? null}
        expiresAt={pendingReveal?.expiresAt ?? 0}
        trumpSuit={game.trumpSuit}
        onDismiss={clearPendingReveal}
      />

      <GameCoachOverlay
        visible={coachVisible}
        steps={coachSteps}
        stepIndex={coachStepIndex}
        onNext={() => setCoachStepIndex((i) => i + 1)}
        onDismiss={dismissCoach}
      />
    </Background>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  safe: { flex: 1 },
  gameColumn: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    minWidth: 0,
  },
  headerActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerBtnText: { fontSize: 13, fontWeight: "700" },
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
  opponentsDense: {
    paddingTop: 2,
    paddingBottom: spacing.xs,
  },
  middle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 0,
  },
  tableSlot: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: spacing.sm,
    minHeight: 0,
  },
  tableSlotDense: {
    justifyContent: "flex-end",
  },
  deckSlot: {
    justifyContent: "center",
    alignItems: "center",
    paddingRight: spacing.md,
  },
  bottom: { paddingBottom: 0, overflow: "visible", gap: 0 },
  humanSeatRow: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  actionDockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    overflow: "visible",
    zIndex: 20,
  },
  actionSide: {
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  actionBtn: {
    paddingVertical: 6,
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
  abilitiesRow: {
    width: "100%",
    alignItems: "stretch",
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    overflow: "hidden",
  },
});
