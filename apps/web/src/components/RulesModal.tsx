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
            <strong>Goal:</strong> The main goal of Durak is to get rid of all your cards. The last player left with cards in their hand is the <strong>Durak</strong> (fool/loser).
          </p>
          <p>
            <strong>The Deck:</strong> A deck of 36 cards is used (ranks 6 through Ace). A random card is selected at start to determine the <strong>Trump Suit</strong> (shown at the side). Trump cards beat all cards of other suits.
          </p>
          <p>
            <strong>Attacking and Defending:</strong>
            <br />
            - The attacker plays any card from their hand.
            <br />
            - The defender must beat it by playing a card of the same suit but higher rank, or a trump card. If the attacked card is a trump, the defender must beat it with a higher trump.
            <br />
            - Other players can throw in additional cards that match the rank of any card already on the table.
          </p>
          <p>
            <strong>Draw or Take:</strong>
            <br />
            - If the defender beats all attack cards, the cards are discarded (moved to the discard pile).
            <br />
            - If the defender cannot beat all cards, they must <strong>TAKE</strong> all cards on the table.
            <br />
            - At the end of the round, all players draw from the deck until they have at least 6 cards (starting with the attackers, ending with the defender).
          </p>
          <p>
            <strong>Passing Variant (Perevodnoy):</strong>
            <br />
            - When attacked, the defender can <strong>transfer</strong> the attack to the next player by playing a card of the same rank as the attacking card. The next player then becomes the defender.
          </p>
        </div>

        <button className="btn btn-primary btn-md" style={{ marginTop: "10px" }} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
};
