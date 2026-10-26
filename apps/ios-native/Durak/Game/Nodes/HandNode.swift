import SpriteKit
import DurakGameCore
import SwiftUI

/// Node displaying the human player's hand cards in a smooth fan arc,
/// supporting drag-to-play gestures and playable card highlights.
final class HandNode: SKNode {
    struct SlotTransform {
        let position: CGPoint
        let rotation: CGFloat
        let zPosition: CGFloat
    }

    private(set) var cardNodes: [CardNode] = []
    private var appearance: AppearancePreset
    private var cardSize: CGSize
    private var viewportWidth: CGFloat = 390

    var selectedCard: CardNode?

    init(appearance: AppearancePreset, cardSize: CGSize = CGSize(width: 90, height: 126)) {
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

    // MARK: - Slot Math

    /// Fan slot transforms for a hand of `count` cards (single source of truth).
    func slotTransforms(count: Int) -> [SlotTransform] {
        guard count > 0 else { return [] }
        let rotPerSlot: CGFloat = count >= 8 ? 1.4 : (count >= 5 ? 1.9 : 2.4)
        let mid = CGFloat(count - 1) / 2.0
        let desiredSpacing = cardSize.width * 0.50
        let safeAvailableWidth = max(cardSize.width, viewportWidth - 36)
        let maxAllowedSpacing = count > 1 ? (safeAvailableWidth - cardSize.width) / CGFloat(count - 1) : 0
        let spacing = count > 1 ? min(desiredSpacing, max(18, maxAllowedSpacing)) : 0

        return (0..<count).map { i in
            let offsetFromMid = CGFloat(i) - mid
            let x = offsetFromMid * spacing
            let rotRadians = (-offsetFromMid * rotPerSlot) * .pi / 180.0
            let y = -abs(offsetFromMid) * 4.0
            return SlotTransform(
                position: CGPoint(x: x, y: y),
                rotation: rotRadians,
                zPosition: CGFloat(100 + i)
            )
        }
    }

    func slotTransform(index: Int, count: Int) -> SlotTransform {
        let slots = slotTransforms(count: count)
        guard index >= 0, index < slots.count else {
            return SlotTransform(position: .zero, rotation: 0, zPosition: 100)
        }
        return slots[index]
    }

    /// Scene-space target for a fan slot (accounts for hand node position/scale).
    func sceneSlot(
        index: Int,
        count: Int,
        in scene: SKNode
    ) -> (position: CGPoint, rotation: CGFloat, zPosition: CGFloat) {
        let slot = slotTransform(index: index, count: count)
        return (
            position: convert(slot.position, to: scene),
            rotation: slot.rotation,
            zPosition: 900 + CGFloat(index)
        )
    }

    // MARK: - Hand Updates

    func updateHand(cards: [Card], playableCardIds: Set<String>, appearance: AppearancePreset) {
        self.appearance = appearance

        let previousIds = cardNodes.map(\.card.id)
        let newIds = cards.map(\.id)
        let membershipChanged = previousIds != newIds

        let currentIds = Set(newIds)
        cardNodes.removeAll { node in
            if !currentIds.contains(node.card.id) {
                if node.parent == self {
                    node.removeFromParent()
                }
                return true
            }
            return false
        }

        let slots = slotTransforms(count: cards.count)

        var updatedNodes: [CardNode] = []
        for (i, card) in cards.enumerated() {
            if let existing = cardNodes.first(where: { $0.card.id == card.id }) {
                existing.updateAppearance(appearance)
                existing.isPlayable = playableCardIds.contains(card.id)
                updatedNodes.append(existing)
            } else {
                let slot = i < slots.count ? slots[i] : SlotTransform(position: .zero, rotation: 0, zPosition: CGFloat(100 + i))
                let newNode = CardNode(card: card, isFaceUp: true, size: cardSize, appearance: appearance)
                newNode.position = slot.position
                newNode.zRotation = slot.rotation
                newNode.zPosition = slot.zPosition
                newNode.originalPosition = slot.position
                newNode.originalRotation = slot.rotation
                newNode.originalZPosition = slot.zPosition
                newNode.isPlayable = playableCardIds.contains(card.id)
                addChild(newNode)
                updatedNodes.append(newNode)
            }
        }
        self.cardNodes = updatedNodes

        layoutFan(animated: membershipChanged)
    }

    /// Adopts a scene-flying card into the hand at its final fan slot (no recreate).
    func adoptFlyingCard(
        _ node: CardNode,
        playable: Bool,
        atSlot index: Int,
        handCount: Int
    ) {
        let slot = slotTransform(index: index, count: handCount)
        let posInHand: CGPoint
        if let parent = node.parent {
            posInHand = convert(node.position, from: parent)
        } else {
            posInHand = slot.position
        }

        node.removeFromParent()
        if node.parent != self {
            addChild(node)
        }
        node.position = posInHand
        // Scene flight used spriteScale under the scene; handNode already applies spriteScale.
        // Display-size only — textures stay canonical (no rebake).
        node.setScale(1.0)
        node.updateSize(cardSize)
        node.isPlayable = playable
        node.originalPosition = slot.position
        node.originalRotation = slot.rotation
        node.originalZPosition = slot.zPosition
        node.zPosition = slot.zPosition

        cardNodes.removeAll { $0.card.id == node.card.id || $0 === node }
        cardNodes.append(node)
    }

    /// Slides existing hand cards toward their final indices in `finalCards` (room for incoming).
    func reflowTowardFinalHand(_ finalCards: [Card], playableCardIds: Set<String>, animated: Bool = true) {
        let finalIds = Set(finalCards.map(\.id))
        cardNodes.removeAll { node in
            if !finalIds.contains(node.card.id) {
                if node.parent == self { node.removeFromParent() }
                return true
            }
            return false
        }

        let count = finalCards.count
        let slots = slotTransforms(count: count)
        for node in cardNodes {
            guard let idx = finalCards.firstIndex(where: { $0.id == node.card.id }) else { continue }
            node.isPlayable = playableCardIds.contains(node.card.id)
            let slot = slots[idx]
            node.originalPosition = slot.position
            node.originalRotation = slot.rotation
            node.originalZPosition = slot.zPosition

            if node.action(forKey: "flyTo") != nil { continue }

            let moved = hypot(node.position.x - slot.position.x, node.position.y - slot.position.y) > 0.75
                || abs(node.zRotation - slot.rotation) > 0.002

            if animated && moved {
                node.flyTo(
                    position: slot.position,
                    rotation: slot.rotation,
                    zPosition: slot.zPosition,
                    duration: CardNode.FlightStyle.reflow.duration,
                    style: .reflow
                )
            } else if !animated || !moved {
                node.removeAction(forKey: "flyTo")
                node.removeAction(forKey: "flyToCompletion")
                node.position = slot.position
                node.zRotation = slot.rotation
                node.zPosition = slot.zPosition
            }
        }
    }

    func layoutFan(animated: Bool = true) {
        let count = cardNodes.count
        guard count > 0 else { return }

        let slots = slotTransforms(count: count)

        for (i, node) in cardNodes.enumerated() {
            guard node != selectedCard else { continue }
            guard i < slots.count else { continue }
            let slot = slots[i]

            node.originalPosition = slot.position
            node.originalRotation = slot.rotation
            node.originalZPosition = slot.zPosition

            // Don't fight an in-flight take/deal.
            if node.action(forKey: "flyTo") != nil { continue }

            let moved = hypot(node.position.x - slot.position.x, node.position.y - slot.position.y) > 0.75
                || abs(node.zRotation - slot.rotation) > 0.002

            if animated && moved {
                node.flyTo(
                    position: slot.position,
                    rotation: slot.rotation,
                    zPosition: slot.zPosition,
                    duration: CardNode.FlightStyle.reflow.duration,
                    style: .reflow
                )
            } else {
                node.removeAction(forKey: "flyTo")
                node.removeAction(forKey: "flyToCompletion")
                node.position = slot.position
                node.zRotation = slot.rotation
                node.zPosition = slot.zPosition
            }
        }
    }

    func cardAt(point: CGPoint) -> CardNode? {
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
        let duration = CardNode.FlightStyle.snapBack.duration
        node.setLifted(false, animated: true, duration: duration)
        node.flyTo(
            position: node.originalPosition,
            rotation: node.originalRotation,
            zPosition: node.originalZPosition,
            scale: 1.0,
            duration: duration,
            style: .snapBack
        )
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
