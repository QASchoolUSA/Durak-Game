import SpriteKit
import DurakGameCore
import SwiftUI

/// Node displaying the human player's hand cards in a smooth fan arc,
/// supporting drag-to-play gestures and playable card highlights.
final class HandNode: SKNode {
    private(set) var cardNodes: [CardNode] = []
    private var appearance: AppearancePreset
    private var cardSize: CGSize
    private var viewportWidth: CGFloat = 390

    var selectedCard: CardNode?

    init(appearance: AppearancePreset, cardSize: CGSize = CGSize(width: 86, height: 120)) {
        self.appearance = appearance
        self.cardSize = cardSize
        super.init()
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func setViewportWidth(_ width: CGFloat) {
        self.viewportWidth = width
    }

    func updateHand(cards: [Card], playableCardIds: Set<String>, appearance: AppearancePreset) {
        self.appearance = appearance

        // Remove removed cards (only detach from hand if still parented here —
        // played cards may already be reparented onto the table).
        let currentIds = Set(cards.map { $0.id })
        cardNodes.removeAll { node in
            if !currentIds.contains(node.card.id) {
                if node.parent == self {
                    node.removeFromParent()
                }
                return true
            }
            return false
        }

        // Add or update cards
        var updatedNodes: [CardNode] = []
        for card in cards {
            if let existing = cardNodes.first(where: { $0.card == card }) {
                existing.updateAppearance(appearance)
                existing.isPlayable = playableCardIds.contains(card.id)
                updatedNodes.append(existing)
            } else {
                let newNode = CardNode(card: card, isFaceUp: true, size: cardSize, appearance: appearance)
                newNode.isPlayable = playableCardIds.contains(card.id)
                addChild(newNode)
                updatedNodes.append(newNode)
            }
        }
        self.cardNodes = updatedNodes

        layoutFan(animated: true)
    }

    func layoutFan(animated: Bool = true) {
        let count = cardNodes.count
        guard count > 0 else { return }

        let rotPerSlot: CGFloat = count >= 8 ? 1.2 : (count >= 5 ? 1.6 : 2.0)
        let mid = CGFloat(count - 1) / 2.0

        let desiredSpacing = cardSize.width * 0.44
        // Guaranteed safe margins so cards are never pushed off screen edges (min 18pt margin on left and right)
        let safeAvailableWidth = max(cardSize.width, viewportWidth - 36)
        let maxAllowedSpacing = count > 1 ? (safeAvailableWidth - cardSize.width) / CGFloat(count - 1) : 0
        let spacing = count > 1 ? min(desiredSpacing, max(18, maxAllowedSpacing)) : 0

        for (i, node) in cardNodes.enumerated() {
            guard node != selectedCard else { continue }

            let offsetFromMid = CGFloat(i) - mid
            let x = offsetFromMid * spacing
            let rotDegrees = -offsetFromMid * rotPerSlot
            let rotRadians = rotDegrees * .pi / 180.0
            // Slight vertical parabolic dip for natural card fan feel
            let y = -abs(offsetFromMid) * 2.0
            let targetPos = CGPoint(x: x, y: y)

            node.originalPosition = targetPos
            node.originalRotation = rotRadians
            node.originalZPosition = CGFloat(100 + i)

            if animated {
                node.flyTo(position: targetPos, rotation: rotRadians, zPosition: node.originalZPosition, duration: 0.25)
            } else {
                node.position = targetPos
                node.zRotation = rotRadians
                node.zPosition = node.originalZPosition
            }
        }
    }

    func cardAt(point: CGPoint) -> CardNode? {
        // Search in reverse z-order (topmost first)
        for node in cardNodes.reversed() {
            let localPoint = convert(point, to: node)
            let halfW = cardSize.width / 2
            let halfH = cardSize.height / 2
            if abs(localPoint.x) <= halfW && abs(localPoint.y) <= halfH {
                return node
            }
        }
        return nil
    }

    func returnCardToFan(_ node: CardNode) {
        node.setLifted(false, animated: true)
        node.flyTo(position: node.originalPosition, rotation: node.originalRotation, zPosition: node.originalZPosition, duration: 0.22)
    }

    /// Drops a card from the fan bookkeeping without destroying it (e.g. play handoff to table).
    func detachCard(_ node: CardNode) {
        cardNodes.removeAll { $0 === node }
        if selectedCard === node {
            selectedCard = nil
        }
        if node.parent == self {
            node.removeFromParent()
        }
        layoutFan(animated: true)
    }
}
