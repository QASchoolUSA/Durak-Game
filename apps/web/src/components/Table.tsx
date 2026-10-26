import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../mobile/convex/_generated/api";
import type { Id } from "../../../mobile/convex/_generated/dataModel";
import { useGameStore } from "../store/gameStore";
import { Card } from "./Card";
import { SettingsModal } from "./SettingsModal";
import { RulesModal } from "./RulesModal";
import { TurnTimerRing } from "./TurnTimerRing";
import { TurnStatusBanner } from "./TurnStatusBanner";
import { ReactionsBar, ReactionBurst } from "./Reactions";
import { trigger as fireFeedback } from "../feedback/feedback";
import {
  useCardPointerDrag,
  type DropZone,
} from "../hooks/useCardPointerDrag";
import {
  legalAttacks,
  legalDefenses,
  legalTransfers,
  canPass,
  canTake,
  handOf,
  type Card as CardModel,
} from "@durak/game-core";

interface ActiveClock {
  id: string;
  left: number;
  total: number;
}

function legalPairIndexesForCard(
  game: NonNullable<ReturnType<typeof useGameStore.getState>["game"]>,
  humanId: string,
  cardId: string,
): number[] {
  if (game.defenderId !== humanId) return [];
  const indexes: number[] = [];
  game.table.forEach((p, i) => {
    if (p.defense) return;
    if (legalDefenses(game, i).some((c) => c.id === cardId)) indexes.push(i);
  });
  return indexes;
}

function resolveDropMove(
  game: NonNullable<ReturnType<typeof useGameStore.getState>["game"]>,
  humanId: string,
  card: CardModel,
  zone: { kind: "field" | "pair"; index?: number } | null,
):
  | { type: "ATTACK"; player: string; card: CardModel }
  | { type: "TRANSFER"; player: string; card: CardModel; target: number }
  | { type: "DEFEND"; player: string; card: CardModel; target: number }
  | null {
  if (!zone) return null;

  if (game.defenderId !== humanId) {
    if (zone.kind === "field" && legalAttacks(game, humanId).some((c) => c.id === card.id)) {
      return { type: "ATTACK", player: humanId, card };
    }
    return null;
  }

  if (legalTransfers(game, 0).some((c) => c.id === card.id)) {
    if (zone.kind === "field" || zone.kind === "pair") {
      return { type: "TRANSFER", player: humanId, card, target: 0 };
    }
  }

  if (zone.kind === "pair" && zone.index != null) {
    if (legalDefenses(game, zone.index).some((c) => c.id === card.id)) {
      return { type: "DEFEND", player: humanId, card, target: zone.index };
    }
    return null;
  }

  if (zone.kind === "field") {
    const unbeaten = game.table
      .map((p, i) => (p.defense ? -1 : i))
      .filter((i) => i !== -1);
    if (unbeaten.length === 1) {
      const targetIdx = unbeaten[0]!;
      if (legalDefenses(game, targetIdx).some((c) => c.id === card.id)) {
        return { type: "DEFEND", player: humanId, card, target: targetIdx };
      }
    }
  }
  return null;
}

export const Table: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const names = useGameStore((s) => s.names);
  const playMode = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const submitHuman = useGameStore((s) => s.submitHuman);
  const goHome = useGameStore((s) => s.goHome);
  const difficulty = useGameStore((s) => s.difficulty);
  const returnExpiresAt = useGameStore((s) => s.returnExpiresAt);
  const returnLastCard = useGameStore((s) => s.returnLastCard);
  const submittingMove = useGameStore((s) => s.submittingMove);
  const opponentReconnecting = useGameStore((s) => s.opponentReconnecting);
  const forfeitMutation = useMutation(api.rooms.forfeit);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const pairRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const dragCardIdRef = useRef<string | null>(null);

  const turnClockPlayerId = useGameStore((s) => s.turnClockPlayerId);
  const [clock, setClock] = useState<ActiveClock | null>(null);
  const autoPlayedForRef = useRef<number>(0);
  const lastWarnRef = useRef<{ id: string; sec: number }>({ id: "", sec: -1 });

  useEffect(() => {
    const tick = () => {
      const st = useGameStore.getState();
      const g = st.game;
      if (!g || g.phase !== "playing") {
        setClock(null);
        return;
      }
      const total = st.turnTimerSeconds;
      let id: string | null = null;
      let deadline: number | null = null;

      if (st.playMode === "online") {
        id = st.turnClockPlayerId;
        deadline = st.turnDeadlineAt;
      } else {
        const human = st.humanId;
        const mustAct =
          canTake(g, human) ||
          canPass(g, human) ||
          legalAttacks(g, human).length > 0 ||
          legalTransfers(g, 0).length > 0 ||
          (g.defenderId === human &&
            g.table.some((p, i) => !p.defense && legalDefenses(g, i).length > 0));
        if (mustAct) {
          id = human;
          deadline = st.lastMoveAt + total * 1000;
        }
      }

      if (!id || !deadline) {
        setClock(null);
        return;
      }

      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setClock({ id, left, total });

      if (id === st.humanId) {
        const sec = Math.ceil(left);
        if (left > 0 && sec <= 3 && (lastWarnRef.current.id !== id || lastWarnRef.current.sec !== sec)) {
          lastWarnRef.current = { id, sec };
          fireFeedback(sec <= 1 ? "timerCritical" : "timerWarning");
        }
      }

      if (left <= 0 && st.playMode === "solo" && id === st.humanId && autoPlayedForRef.current !== deadline) {
        autoPlayedForRef.current = deadline;
        st.autoPlayHuman();
      }
    };

    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, []);

  const [returnLeft, setReturnLeft] = useState(0);
  useEffect(() => {
    if (!returnExpiresAt) {
      setReturnLeft(0);
      return;
    }
    const update = () => setReturnLeft(Math.max(0, returnExpiresAt - Date.now()));
    update();
    const t = setInterval(update, 100);
    return () => clearInterval(t);
  }, [returnExpiresAt]);

  const myHand = game ? handOf(game, humanId) : [];

  const isCardPlayable = useCallback(
    (cardId: string): boolean => {
      if (!game || game.phase !== "playing" || submittingMove) return false;
      if (!myHand.some((c) => c.id === cardId)) return false;
      if (legalAttacks(game, humanId).some((c) => c.id === cardId)) return true;
      if (legalTransfers(game, 0).some((c) => c.id === cardId)) return true;
      if (game.defenderId === humanId) {
        return legalPairIndexesForCard(game, humanId, cardId).length > 0;
      }
      return false;
    },
    [game, humanId, myHand, submittingMove],
  );

  const getZones = useCallback((): DropZone[] => {
    if (!game || !fieldRef.current) return [];
    const cardId = dragCardIdRef.current;
    const zones: DropZone[] = [];

    const canAttack =
      !!cardId &&
      game.defenderId !== humanId &&
      legalAttacks(game, humanId).some((c) => c.id === cardId);
    const canTransfer =
      !!cardId && legalTransfers(game, 0).some((c) => c.id === cardId);
    const pairLegal = cardId
      ? legalPairIndexesForCard(game, humanId, cardId)
      : [];
    const singleDefendField =
      !!cardId &&
      game.defenderId === humanId &&
      pairLegal.length === 1 &&
      !canTransfer;

    zones.push({
      kind: "field",
      legal: canAttack || canTransfer || singleDefendField,
      el: fieldRef.current,
    });

    game.table.forEach((_, idx) => {
      const el = pairRefs.current.get(idx);
      if (!el) return;
      zones.push({
        kind: "pair",
        index: idx,
        legal: pairLegal.includes(idx) || (canTransfer && idx === 0),
        el,
      });
    });
    return zones;
  }, [game, humanId]);

  const onDrop = useCallback(
    (cardId: string, zone: { kind: "field" | "pair"; index?: number } | null) => {
      dragCardIdRef.current = null;
      if (!game || submittingMove) return false;
      const card = myHand.find((c) => c.id === cardId);
      if (!card) return false;
      const move = resolveDropMove(game, humanId, card, zone);
      if (!move) return false;
      submitHuman(move);
      setSelectedCardId(null);
      return true;
    },
    [game, humanId, myHand, submitHuman, submittingMove],
  );

  const drag = useCardPointerDrag({
    enabled: !!game && game.phase === "playing" && !submittingMove,
    getZones,
    onDrop,
  });

  const wrapPointerDown = useCallback(
    (e: React.PointerEvent, cardId: string) => {
      dragCardIdRef.current = cardId;
      drag.onPointerDown(e, cardId);
    },
    [drag],
  );

  const wrapPointerUp = useCallback(
    (e: React.PointerEvent) => {
      drag.onPointerUp(e);
      if (!drag.ghost) dragCardIdRef.current = null;
    },
    [drag],
  );

  const wrapPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      dragCardIdRef.current = null;
      drag.onPointerCancel(e);
    },
    [drag],
  );

  // Keyboard: Esc already in hook; Space/Enter for Pass/Take
  useEffect(() => {
    if (!game) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (drag.ghost) return;
      if (e.key === " " || e.key === "Enter") {
        if (canPass(game, humanId)) {
          e.preventDefault();
          submitHuman({ type: "PASS", player: humanId });
        } else if (canTake(game, humanId)) {
          e.preventDefault();
          submitHuman({ type: "TAKE", player: humanId });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, humanId, submitHuman, drag.ghost]);

  const handleCardClick = (cardId: string) => {
    if (drag.shouldSuppressClick()) return;
    if (!game || game.phase !== "playing" || submittingMove) return;
    const card = myHand.find((c) => c.id === cardId);
    if (!card) return;

    if (game.defenderId !== humanId) {
      if (legalAttacks(game, humanId).some((c) => c.id === cardId)) {
        submitHuman({ type: "ATTACK", player: humanId, card });
      }
      return;
    }

    if (legalTransfers(game, 0).some((c) => c.id === cardId)) {
      submitHuman({ type: "TRANSFER", player: humanId, card, target: 0 });
      return;
    }

    const unbeatenIndexes = game.table
      .map((p, i) => (p.defense ? -1 : i))
      .filter((i) => i !== -1);

    if (unbeatenIndexes.length === 1) {
      const targetIdx = unbeatenIndexes[0]!;
      if (legalDefenses(game, targetIdx).some((c) => c.id === cardId)) {
        submitHuman({ type: "DEFEND", player: humanId, card, target: targetIdx });
      }
    } else if (unbeatenIndexes.length > 1) {
      setSelectedCardId(selectedCardId === cardId ? null : cardId);
    }
  };

  const handleTableCardClick = (targetIndex: number) => {
    if (!game || !selectedCardId || game.defenderId !== humanId || submittingMove) return;
    const card = myHand.find((c) => c.id === selectedCardId);
    if (!card) return;
    if (legalDefenses(game, targetIndex).some((c) => c.id === selectedCardId)) {
      submitHuman({ type: "DEFEND", player: humanId, card, target: targetIndex });
      setSelectedCardId(null);
    }
  };

  const handlePass = () => {
    if (game && canPass(game, humanId) && !submittingMove) {
      submitHuman({ type: "PASS", player: humanId });
    }
  };

  const handleTake = () => {
    if (game && canTake(game, humanId) && !submittingMove) {
      submitHuman({ type: "TAKE", player: humanId });
    }
  };

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      if (playMode === "online" && onlineRoomId && game?.phase === "playing") {
        await forfeitMutation({ roomId: onlineRoomId as Id<"rooms"> });
      }
    } catch (err) {
      console.error("forfeit failed", err);
    } finally {
      goHome();
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  const rotatedOpponents = useMemo(() => {
    if (!game) return [];
    const idx = game.players.indexOf(humanId);
    if (idx === -1) return game.players;
    return [...game.players.slice(idx + 1), ...game.players.slice(0, idx)];
  }, [game, humanId]);

  const ghostCard = ghostCardFromHand(myHand, drag.ghost?.cardId);

  const fieldLegalHighlight =
    !!drag.ghost &&
    drag.hover?.kind === "field" &&
    getZones().some((z) => z.kind === "field" && z.legal);

  if (!game) return null;

  return (
    <div className="game-area">
      <ReactionBurst />

      <div className="game-top-chrome">
        <TurnStatusBanner
          game={game}
          humanId={humanId}
          names={names}
          submittingMove={submittingMove}
          opponentReconnecting={opponentReconnecting}
        />
      </div>

      <div className="opponents-row">
        {rotatedOpponents.map((oppId) => {
          const oppHand = handOf(game, oppId);
          const isAttacker = game.attackerId === oppId;
          const isDefender = game.defenderId === oppId;
          const isActive = (clock?.id ?? turnClockPlayerId) === oppId;
          const showCount = Math.min(oppHand.length, 8);

          return (
            <div
              key={oppId}
              className={`opponent-seat ${isActive ? "active" : ""}`}
              data-seat={oppId}
            >
              <div className="opponent-fan" aria-hidden="true">
                {Array.from({ length: showCount }).map((_, i) => (
                  <div
                    key={i}
                    className="opponent-fan-card"
                    style={{
                      transform: `rotate(${(i - (showCount - 1) / 2) * 7}deg) translateY(${Math.abs(i - (showCount - 1) / 2) * 2}px)`,
                      zIndex: i,
                    }}
                  >
                    <Card faceDown style={{ width: "36px", height: "52px" }} />
                  </div>
                ))}
              </div>
              <div className="opponent-meta">
                <span className="opponent-name">
                  {names[oppId] || oppId}
                  {isAttacker ? " · ATK" : ""}
                  {isDefender ? " · DEF" : ""}
                </span>
                <span className="opponent-card-count">{oppHand.length} cards</span>
              </div>
              {clock && clock.id === oppId && (
                <TurnTimerRing secondsLeft={clock.left} totalSeconds={clock.total} size={38} />
              )}
            </div>
          );
        })}
      </div>

      <div className="board-middle">
        <div className="deck-side-panel">
          <div className="trump-indicator">
            {game.deck.length > 0 ? (
              <>
                <div className="deck-pile">{game.deck.length}</div>
                {game.trumpCard && (
                  <div className="trump-card-under">
                    <Card card={game.trumpCard} />
                  </div>
                )}
              </>
            ) : (
              <div className="trump-suit-badge">
                Trump: {game.trumpSuit === "hearts" && "♥"}
                {game.trumpSuit === "diamonds" && "♦"}
                {game.trumpSuit === "clubs" && "♣"}
                {game.trumpSuit === "spades" && "♠"}
              </div>
            )}
          </div>
        </div>

        <div
          ref={fieldRef}
          className={`card-battlefield ${fieldLegalHighlight ? "drag-over" : ""} ${drag.ghost ? "drag-active" : ""}`}
        >
          {game.table.map((pair, idx) => {
            const unbeaten = !pair.defense;
            const isClickableTarget =
              selectedCardId !== null &&
              unbeaten &&
              legalDefenses(game, idx).some((c) => c.id === selectedCardId);
            const pairHover =
              drag.hover?.kind === "pair" &&
              drag.hover.index === idx &&
              !!drag.ghost;

            return (
              <div
                key={idx}
                ref={(el) => {
                  if (el) pairRefs.current.set(idx, el);
                  else pairRefs.current.delete(idx);
                }}
                className={`battle-pair ${pairHover ? "drag-over" : ""} ${isClickableTarget ? "click-target" : ""}`}
                onClick={() => isClickableTarget && handleTableCardClick(idx)}
              >
                <div className="attacker-card">
                  <Card card={pair.attack} />
                </div>
                {pair.defense && (
                  <div className="defender-card">
                    <Card card={pair.defense} />
                  </div>
                )}
              </div>
            );
          })}
          {game.table.length === 0 && (
            <div className="battlefield-hint">
              {drag.ghost ? "Drop to play" : "Battle area"}
            </div>
          )}
        </div>

        <div className="deck-side-panel">
          <div className="discard-pile">
            <span>DISCARD</span>
            <span>{game.discard.length}</span>
          </div>
        </div>
      </div>

      <div className="player-hand-container">
        <div className="table-controls action-dock">
          {clock && clock.id === humanId && (
            <TurnTimerRing secondsLeft={clock.left} totalSeconds={clock.total} size={40} />
          )}
          {returnLeft > 0 && (
            <button
              className="btn btn-secondary btn-sm return-pill"
              onClick={() => returnLastCard()}
              disabled={submittingMove}
            >
              Undo ({Math.ceil(returnLeft / 1000)})
            </button>
          )}
          {canPass(game, humanId) && (
            <button
              className="btn btn-primary btn-md"
              onClick={handlePass}
              disabled={submittingMove}
            >
              Done
            </button>
          )}
          {canTake(game, humanId) && (
            <button
              className="btn btn-danger btn-md"
              onClick={handleTake}
              disabled={submittingMove}
            >
              Take
            </button>
          )}
          {playMode === "online" && <ReactionsBar />}
          <button className="btn btn-secondary btn-sm" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setRulesOpen(true)}>
            Rules
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setConfirmLeave(true)}
            disabled={leaving}
          >
            Leave
          </button>
        </div>

        <div className="player-hand">
          <div className="hand-cards-list">
            {myHand.map((card) => {
              const playable = isCardPlayable(card.id);
              const selected = selectedCardId === card.id;
              const isDragging = drag.ghost?.cardId === card.id;

              return (
                <div
                  key={card.id}
                  className={`card-item ${selected ? "selected" : ""} ${playable ? "playable" : ""}`}
                >
                  <Card
                    card={card}
                    selected={selected}
                    highlighted={playable}
                    dragging={isDragging}
                    grabCursor={playable}
                    onClick={() => handleCardClick(card.id)}
                    onPointerDown={
                      playable ? (e) => wrapPointerDown(e, card.id) : undefined
                    }
                    onPointerMove={playable ? drag.onPointerMove : undefined}
                    onPointerUp={playable ? wrapPointerUp : undefined}
                    onPointerCancel={playable ? wrapPointerCancel : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="player-meta-row">
          <span>You: {names[humanId] || "Player"}</span>
          <span>·</span>
          <span>Attacker: {names[game.attackerId] || game.attackerId}</span>
          <span>·</span>
          <span>Defender: {names[game.defenderId] || game.defenderId}</span>
          {playMode === "solo" && (
            <>
              <span>·</span>
              <span style={{ textTransform: "uppercase" }}>{difficulty}</span>
            </>
          )}
        </div>
      </div>

      {drag.ghost && ghostCard && (
        <div
          className="card-drag-ghost"
          style={{
            left: drag.ghost.x,
            top: drag.ghost.y,
            width: drag.ghost.width,
            height: drag.ghost.height,
          }}
        >
          <Card card={ghostCard} style={{ width: "100%", height: "100%" }} />
        </div>
      )}

      {confirmLeave && (
        <div className="modal-overlay" onClick={() => !leaving && setConfirmLeave(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2 style={{ marginTop: 0 }}>Leave game?</h2>
            <p style={{ color: "var(--text-muted)" }}>
              {playMode === "online" && game.phase === "playing"
                ? "Leaving now forfeits the match and returns you to the menu."
                : "Return to the main menu?"}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                className="btn btn-danger btn-md"
                style={{ flex: 1 }}
                disabled={leaving}
                onClick={() => void handleLeave()}
              >
                {leaving ? "Leaving…" : "Forfeit & Leave"}
              </button>
              <button
                className="btn btn-secondary btn-md"
                style={{ flex: 1 }}
                disabled={leaving}
                onClick={() => setConfirmLeave(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesModal visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
};

function ghostCardFromHand(hand: CardModel[], cardId?: string) {
  if (!cardId) return null;
  return hand.find((c) => c.id === cardId) ?? null;
}
