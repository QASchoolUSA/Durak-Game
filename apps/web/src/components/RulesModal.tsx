import React from "react";

interface RulesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ visible, onClose }) => {
  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h3>HOW TO PLAY DURAK</h3>

        <div className="rules-body">
          <p>
            <strong>Goal:</strong> Get rid of all your cards. The last player
            holding cards is the <strong>Durak</strong> (fool).
          </p>
          <p>
            <strong>Setup:</strong> 36-card deck (6–Ace), 6 cards each. Bottom
            card sets the trump suit. Lowest trump in hand attacks first.
          </p>
          <p>
            <strong>Attacking:</strong> Open with any card. Others (except the
            defender) may throw in ranks already on the table (attack or
            defense). Cap: 5 attacking cards until the first successful discard,
            then 6 — and never more than the defender held at the start of the
            bout.
          </p>
          <p>
            <strong>Defending:</strong> Higher same suit, or any trump vs
            non-trump. Trump only by a higher trump.
          </p>
          <p>
            <strong>Taking:</strong> Press TAKE first; attackers may still add
            matching ranks afterward (within caps). You pick up the table and
            skip the next attack.
          </p>
          <p>
            <strong>Perevodnoy:</strong> Before any defense, add the same rank
            to pass the pile to the next player. Same-rank throw-ins keep the
            window open; any defense closes it. Next player must hold enough
            cards. Transfers stay off until the first successful discard by
            default.
          </p>
          <p>
            <strong>Drawing:</strong> Refill to 6 after each bout — attacker
            first, defender last (skipped if they took).
          </p>
          <p>
            <strong>House rules here:</strong> Throw-in scope All or Neighbors.
            No trump-6 face-up swap. No partnership teams.
          </p>
        </div>

        <button className="btn btn-primary btn-md" style={{ marginTop: "10px" }} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
};
