import React, { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";

const EMOJIS = ["👍", "😂", "😮", "😢", "🔥", "👏", "🤔", "🧂"];

/** Floating emoji burst overlay — shows local + remote reactions rising and fading. */
export const ReactionBurst: React.FC = () => {
  const localReaction = useGameStore((s) => s.localReaction);
  const remoteReaction = useGameStore((s) => s.remoteReaction);
  const humanId = useGameStore((s) => s.humanId);

  const [bursts, setBursts] = useState<
    { id: number; emoji: string; from: "you" | "them" }[]
  >([]);
  const seenLocal = useRef(0);
  const seenRemote = useRef(0);
  const idc = useRef(0);

  useEffect(() => {
    if (localReaction && localReaction.at > seenLocal.current) {
      seenLocal.current = localReaction.at;
      const id = ++idc.current;
      setBursts((b) => [...b, { id, emoji: localReaction.emoji, from: "you" }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1900);
    }
  }, [localReaction]);

  useEffect(() => {
    if (
      remoteReaction &&
      remoteReaction.at > seenRemote.current &&
      remoteReaction.fromPlayerId !== humanId
    ) {
      seenRemote.current = remoteReaction.at;
      const id = ++idc.current;
      setBursts((b) => [...b, { id, emoji: remoteReaction.emoji, from: "them" }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1900);
    }
  }, [remoteReaction, humanId]);

  if (bursts.length === 0) return null;

  return (
    <div className="reaction-burst-layer" aria-hidden="true">
      {bursts.map((b) => (
        <span key={b.id} className={`reaction-burst ${b.from}`}>
          {b.emoji}
        </span>
      ))}
    </div>
  );
};

/** Emoji reaction picker — a toggle button that opens a row of emojis. */
export const ReactionsBar: React.FC = () => {
  const react = useGameStore((s) => s.react);
  const [open, setOpen] = useState(false);

  return (
    <div className="reactions-bar">
      {open && (
        <div className="reactions-tray">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className="reaction-emoji-btn"
              onClick={() => {
                react(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Send a reaction"
      >
        😊
      </button>
    </div>
  );
};
