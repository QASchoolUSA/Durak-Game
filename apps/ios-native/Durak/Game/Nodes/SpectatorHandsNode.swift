import SpriteKit
import DurakGameCore
import SwiftUI

/// Bottom strip showing face-up hands of all remaining players when the human
/// is finished and spectating (solo / offline only).
final class SpectatorHandsNode: SKNode {
    private var appearance: AppearancePreset
    private var cardSize: CGSize
    private var viewportWidth: CGFloat = 390
    private var fanContainers: [PlayerId: SKNode] = [:]
    private var cardNodesByPlayer: [PlayerId: [CardNode]] = [:]

    init(appearance: AppearancePreset, cardSize: CGSize = CGSize(width: 52, height: 72)) {
        self.appearance = appearance
        self.cardSize = cardSize
        super.init()
        isHidden = true
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func setViewportWidth(_ width: CGFloat) {
        viewportWidth = width
    }

    func update(
        players: [(id: PlayerId, name: String, cards: [Card])],
        appearance: AppearancePreset,
        visible: Bool
    ) {
        self.appearance = appearance
        isHidden = !visible || players.isEmpty
        guard visible, !players.isEmpty else {
            clearAll()
            return
        }

        let activeIds = Set(players.map(\.id))
        for (pid, container) in fanContainers where !activeIds.contains(pid) {
            container.removeFromParent()
            fanContainers.removeValue(forKey: pid)
            cardNodesByPlayer.removeValue(forKey: pid)
        }

        let count = players.count
        let sectionWidth = viewportWidth / CGFloat(max(count, 1))

        for (index, entry) in players.enumerated() {
            let container: SKNode
            if let existing = fanContainers[entry.id] {
                container = existing
            } else {
                container = SKNode()
                addChild(container)
                fanContainers[entry.id] = container

                let nameLabel = SKLabelNode(text: entry.name)
                nameLabel.name = "nameLabel"
                nameLabel.fontName = "HelveticaNeue-Medium"
                nameLabel.fontSize = 10
                nameLabel.fontColor = UIColor(DesignTokens.Colors.textMuted)
                nameLabel.horizontalAlignmentMode = .center
                nameLabel.verticalAlignmentMode = .bottom
                nameLabel.position = CGPoint(x: 0, y: cardSize.height * 0.55 + 4)
                container.addChild(nameLabel)
            }

            if let nameLabel = container.childNode(withName: "nameLabel") as? SKLabelNode {
                nameLabel.text = entry.name
                nameLabel.fontColor = UIColor(appearance.ui.accent).withAlphaComponent(0.9)
            }

            let x = -viewportWidth / 2 + sectionWidth * (CGFloat(index) + 0.5)
            container.position = CGPoint(x: x, y: 0)

            layoutFan(for: entry.id, cards: entry.cards, in: container, sectionWidth: sectionWidth)
        }
    }

    private func layoutFan(for playerId: PlayerId, cards: [Card], in container: SKNode, sectionWidth: CGFloat) {
        var nodes = cardNodesByPlayer[playerId] ?? []
        let ids = Set(cards.map(\.id))

        nodes.removeAll { node in
            if !ids.contains(node.card.id) {
                node.removeFromParent()
                return true
            }
            return false
        }

        var updated: [CardNode] = []
        for card in cards {
            if let existing = nodes.first(where: { $0.card.id == card.id }) {
                existing.updateAppearance(appearance)
                updated.append(existing)
            } else {
                let node = CardNode(card: card, isFaceUp: true, size: cardSize, appearance: appearance)
                container.addChild(node)
                updated.append(node)
            }
        }
        cardNodesByPlayer[playerId] = updated

        let n = updated.count
        guard n > 0 else { return }

        let mid = CGFloat(n - 1) / 2.0
        let desiredSpacing = cardSize.width * 0.38
        let maxSpacing = n > 1 ? max(10, (sectionWidth - cardSize.width - 8) / CGFloat(n - 1)) : 0
        let spacing = n > 1 ? min(desiredSpacing, maxSpacing) : 0

        for (i, node) in updated.enumerated() {
            let offset = CGFloat(i) - mid
            let pos = CGPoint(x: offset * spacing, y: -abs(offset) * 1.2)
            node.zPosition = CGFloat(i)
            node.flyTo(position: pos, rotation: offset * -0.02, zPosition: CGFloat(i), duration: 0.2)
        }
    }

    private func clearAll() {
        for container in fanContainers.values {
            container.removeFromParent()
        }
        fanContainers.removeAll()
        cardNodesByPlayer.removeAll()
    }
}
