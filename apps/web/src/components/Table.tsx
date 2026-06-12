import React, { useState, useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import { Card } from "./Card";
import { SettingsModal } from "./SettingsModal";
import { RulesModal } from "./RulesModal";
import {
  legalAttacks,
  legalDefenses,
  legalTransfers,
  canPass,
  canTake,
  handOf,
} from "@durak/game-core";

export const Table: React.FC = () => {
  const game = useGameStore((s) => s.game);
  const humanId = useGameStore((s) => s.humanId);
  const names = useGameStore((s) => s.names);
  const playMode = useGameStore((s) => s.playMode);
  const submitHuman = useGameStore((s) => s.submitHuman);
  const goHome = useGameStore((s) => s.goHome);
  const difficulty = useGameStore((s) => s.difficulty);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Drag and drop states
  const [isDraggingOverField, setIsDraggingOverField] = useState(false);
  const [draggingOverPairIdx, setDraggingOverPairIdx] = useState<number | null>(null);

  // Time tracking for turn timer clock
  const turnClockPlayerId = useGameStore((s) => s.turnClockPlayerId);
  const turnDeadlineAt = useGameStore((s) => s.turnDeadlineAt);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!turnDeadlineAt) {
      setTimeLeft(null);
      return;
    }
    const updateTime = () => {
      const remaining = Math.max(0, Math.round((turnDeadlineAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [turnDeadlineAt]);

  if (!game) return null;

  const myHand = handOf(game, humanId);

  // Rotate players so "you" are at the bottom and others are around the table
  const rotatedOpponents = (() => {
    const idx = game.players.indexOf(humanId);
    if (idx === -1) return game.players;
    const rotated = [...game.players.slice(idx + 1), ...game.players.slice(0, idx)];
    return rotated;
  })();

  // Card playable indicator check
  const isCardPlayable = (cardId: string): boolean => {
    if (game.phase !== "playing") return false;
    const card = myHand.find((c) => c.id === cardId);
    if (!card) return false;

    // Check if legal attack/throw-in
    const attacks = legalAttacks(game, humanId);
    if (attacks.some((c) => c.id === cardId)) return true;

    // Check if legal transfer
    const transfers = legalTransfers(game, 0);
    if (transfers.some((c) => c.id === cardId)) return true;

    // Check if legal defense
    if (game.defenderId === humanId) {
      const unbeatenIndexes = game.table
        .map((p, i) => (p.defense ? -1 : i))
        .filter((i) => i !== -1);
      
      for (const targetIdx of unbeatenIndexes) {
        const defenses = legalDefenses(game, targetIdx);
        if (defenses.some((c) => c.id === cardId)) return true;
      }
    }

    return false;
  };

  const handleCardClick = (cardId: string) => {
    if (game.phase !== "playing") return;
    const card = myHand.find((c) => c.id === cardId);
    if (!card) return;

    // If human is attacker/thrower
    if (game.defenderId !== humanId) {
      const attacks = legalAttacks(game, humanId);
      if (attacks.some((c) => c.id === cardId)) {
        submitHuman({ type: "ATTACK", player: humanId, card });
      }
      return;
    }

    // If human is defender
    if (game.defenderId === humanId) {
      const transfers = legalTransfers(game, 0);
      if (transfers.some((c) => c.id === cardId)) {
        submitHuman({ type: "TRANSFER", player: humanId, card, target: 0 });
        return;
      }

      // Find unbeaten attacks
      const unbeatenIndexes = game.table
        .map((p, i) => (p.defense ? -1 : i))
        .filter((i) => i !== -1);

      if (unbeatenIndexes.length === 1) {
        const targetIdx = unbeatenIndexes[0]!;
        const defenses = legalDefenses(game, targetIdx);
        if (defenses.some((c) => c.id === cardId)) {
          submitHuman({ type: "DEFEND", player: humanId, card, target: targetIdx });
        }
      } else if (unbeatenIndexes.length > 1) {
        // Toggle selection
        setSelectedCardId(selectedCardId === cardId ? null : cardId);
      }
    }
  };

  const handleTableCardClick = (targetIndex: number) => {
    if (!selectedCardId || game.defenderId !== humanId) return;
    const card = myHand.find((c) => c.id === selectedCardId);
    if (!card) return;

    const defenses = legalDefenses(game, targetIndex);
    if (defenses.some((c) => c.id === selectedCardId)) {
      submitHuman({ type: "DEFEND", player: humanId, card, target: targetIndex });
      setSelectedCardId(null);
    }
  };

  const handlePass = () => {
    if (canPass(game, humanId)) {
      submitHuman({ type: "PASS", player: humanId });
    }
  };

  const handleTake = () => {
    if (canTake(game, humanId)) {
      submitHuman({ type: "TAKE", player: humanId });
    }
  };

  // Drag and drop event handlers
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnterField = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverField(true);
  };

  const handleDragLeaveField = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverField(false);
  };

  const handleDropField = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverField(false);
    const cardId = e.dataTransfer.getData("text/plain");
    if (!cardId) return;
    const card = myHand.find((c) => c.id === cardId);
    if (!card) return;

    // 1. Attack / Throw-in
    if (game.defenderId !== humanId) {
      const attacks = legalAttacks(game, humanId);
      if (attacks.some((c) => c.id === cardId)) {
        submitHuman({ type: "ATTACK", player: humanId, card });
      }
      return;
    }

    // 2. Transfer / Defend auto
    if (game.defenderId === humanId) {
      const transfers = legalTransfers(game, 0);
      if (transfers.some((c) => c.id === cardId)) {
        submitHuman({ type: "TRANSFER", player: humanId, card, target: 0 });
        return;
      }

      // If only one unbeaten attack, drop on field plays defense
      const unbeatenIndexes = game.table
        .map((p, i) => (p.defense ? -1 : i))
        .filter((i) => i !== -1);
      if (unbeatenIndexes.length === 1) {
        const targetIdx = unbeatenIndexes[0]!;
        const defenses = legalDefenses(game, targetIdx);
        if (defenses.some((c) => c.id === cardId)) {
          submitHuman({ type: "DEFEND", player: humanId, card, target: targetIdx });
        }
      }
    }
  };

  const handleDragEnterPair = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDraggingOverPairIdx(idx);
  };

  const handleDragLeavePair = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOverPairIdx(null);
  };

  const handleDropPair = (e: React.DragEvent, targetIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingOverPairIdx(null);
    const cardId = e.dataTransfer.getData("text/plain");
    if (!cardId) return;
    const card = myHand.find((c) => c.id === cardId);
    if (!card) return;

    if (game.defenderId === humanId) {
      const defenses = legalDefenses(game, targetIndex);
      if (defenses.some((c) => c.id === cardId)) {
        submitHuman({ type: "DEFEND", player: humanId, card, target: targetIndex });
      }
    }
  };

  return (
    <div className="game-area">
      {/* Opponents Row at top */}
      <div className="opponents-row">
        {rotatedOpponents.map((oppId) => {
          const oppHand = handOf(game, oppId);
          const isAttacker = game.attackerId === oppId;
          const isDefender = game.defenderId === oppId;
          const isActive = turnClockPlayerId === oppId;

          return (
            <div key={oppId} className={`opponent-seat ${isActive ? "active" : ""}`}>
              <div className="opponent-meta">
                <span className="opponent-name">
                  {names[oppId] || oppId}
                  {isAttacker && " ⚔️"}
                  {isDefender && " 🛡️"}
                </span>
                <span className="opponent-card-count">
                  🎴 {oppHand.length} cards
                </span>
              </div>
              {isActive && timeLeft !== null && (
                <div style={{ fontSize: "12px", color: "var(--gold)", fontWeight: "900" }}>
                  ⏳ {timeLeft}s
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Middle board (Draw pile, Discard, Battlefield) */}
      <div className="board-middle">
        {/* Left column: Draw pile & Trump indicator */}
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
                Trump: {game.trumpSuit === "hearts" && "♥️"}
                {game.trumpSuit === "diamonds" && "♦️"}
                {game.trumpSuit === "clubs" && "♣️"}
                {game.trumpSuit === "spades" && "♠️"}
              </div>
            )}
          </div>
        </div>

        {/* Center column: Battlefield */}
        <div
          className={`card-battlefield ${isDraggingOverField ? "drag-over" : ""}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnterField}
          onDragLeave={handleDragLeaveField}
          onDrop={handleDropField}
        >
          {game.table.map((pair, idx) => {
            const unbeaten = !pair.defense;
            const isClickableTarget =
              selectedCardId !== null &&
              unbeaten &&
              legalDefenses(game, idx).some(
                (c) => c.id === selectedCardId
              );

            const isTargetedByDrag = draggingOverPairIdx === idx;

            return (
              <div
                key={idx}
                className={`battle-pair ${isTargetedByDrag ? "drag-over" : ""}`}
                onClick={() => isClickableTarget && handleTableCardClick(idx)}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnterPair(e, idx)}
                onDragLeave={handleDragLeavePair}
                onDrop={(e) => handleDropPair(e, idx)}
                style={{
                  cursor: isClickableTarget ? "pointer" : "default",
                  border: isClickableTarget 
                    ? "2px dashed var(--gold-bright)" 
                    : isTargetedByDrag 
                      ? "2px dashed var(--gold-bright)" 
                      : "none",
                  borderRadius: "8px",
                }}
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
        </div>

        {/* Right column: Discard pile */}
        <div className="deck-side-panel">
          <div className="discard-pile">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
            </svg>
            <span>DISCARD</span>
            <span>{game.discard.length} cards</span>
          </div>
        </div>
      </div>

      {/* Bottom Area: Controls & Player Hand */}
      <div className="player-hand-container">
        <div className="table-controls">
          {canPass(game, humanId) && (
            <button className="btn btn-primary btn-md" onClick={handlePass}>
              PASS
            </button>
          )}
          {canTake(game, humanId) && (
            <button className="btn btn-danger btn-md" onClick={handleTake}>
              TAKE CARDS
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setRulesOpen(true)}>
            Rules
          </button>
          <button className="btn btn-secondary btn-sm" onClick={goHome}>
            LEAVE
          </button>
        </div>

        <div className="player-hand">
          <div className="hand-cards-list">
            {myHand.map((card) => {
              const playable = isCardPlayable(card.id);
              const selected = selectedCardId === card.id;

              return (
                <div key={card.id} className="card-item">
                  <Card
                    card={card}
                    selected={selected}
                    highlighted={playable}
                    onClick={() => handleCardClick(card.id)}
                    draggable={playable}
                    onDragStart={(e) => handleDragStart(e, card.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
          <span>You: {names[humanId] || "Player"}</span>
          <span>•</span>
          <span>Attacker: {names[game.attackerId] || game.attackerId}</span>
          <span>•</span>
          <span>Defender: {names[game.defenderId] || game.defenderId}</span>
          {playMode === "solo" && (
            <>
              <span>•</span>
              <span style={{ textTransform: "uppercase" }}>Difficulty: {difficulty}</span>
            </>
          )}
        </div>
      </div>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesModal visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
};
