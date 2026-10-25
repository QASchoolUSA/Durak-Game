import SpriteKit
import DurakGameCore
import SwiftUI

/// Node displaying the draw deck pile and face-up trump card underneath.
final class DeckPileNode: SKNode {
    private var trumpCardNode: CardNode?
    private let stackContainer = SKNode()
    private let countBadgeNode = SKNode()
    private let countLabel = SKLabelNode()
    private let trumpSuitBadge = SKNode()
    private let trumpSuitLabel = SKLabelNode()
    private let badgeBg = SKShapeNode(rectOf: CGSize(width: 34, height: 20), cornerRadius: 10)
    private let glowRing = SKShapeNode(circleOfRadius: 19)
    private let innerBg = SKShapeNode(circleOfRadius: 17)

    private var appearance: AppearancePreset
    private var cardSize: CGSize

    init(appearance: AppearancePreset, cardSize: CGSize = CGSize(width: 52, height: 74)) {
        self.appearance = appearance
        self.cardSize = cardSize
        super.init()

        addChild(stackContainer)
        setupBadge()
        setupTrumpBadge()
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupBadge() {
        // High-contrast pill badge on the face-down deck stack
        badgeBg.fillColor = UIColor(appearance.ui.surfaceGlass).withAlphaComponent(0.96)
        badgeBg.strokeColor = UIColor(appearance.ui.accent)
        badgeBg.lineWidth = 1.5
        countBadgeNode.addChild(badgeBg)

        countLabel.fontName = "HelveticaNeue-Bold"
        countLabel.fontSize = 12
        countLabel.fontColor = UIColor(DesignTokens.Colors.textLight)
        countLabel.horizontalAlignmentMode = .center
        countLabel.verticalAlignmentMode = .center
        countBadgeNode.addChild(countLabel)

        countBadgeNode.zPosition = 60
        addChild(countBadgeNode)
    }

    private func setupTrumpBadge() {
        // Outer subtle theme glow ring
        glowRing.fillColor = .clear
        glowRing.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.4)
        glowRing.lineWidth = 1.5
        trumpSuitBadge.addChild(glowRing)

        // Inner prominent badge
        innerBg.fillColor = UIColor(appearance.ui.surfaceGlass).withAlphaComponent(0.98)
        innerBg.strokeColor = UIColor(appearance.ui.accent)
        innerBg.lineWidth = 2.0
        trumpSuitBadge.addChild(innerBg)

        trumpSuitLabel.fontName = "HelveticaNeue-Bold"
        trumpSuitLabel.fontSize = 24
        trumpSuitLabel.verticalAlignmentMode = .center
        trumpSuitLabel.horizontalAlignmentMode = .center
        trumpSuitBadge.addChild(trumpSuitLabel)

        trumpSuitBadge.zPosition = 40
        addChild(trumpSuitBadge)
    }

    func update(deckCount: Int, trumpCard: Card?, appearance: AppearancePreset) {
        self.appearance = appearance
        badgeBg.strokeColor = UIColor(appearance.ui.accent)
        badgeBg.fillColor = UIColor(appearance.ui.surfaceGlass).withAlphaComponent(0.96)
        glowRing.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.4)
        innerBg.strokeColor = UIColor(appearance.ui.accent)
        innerBg.fillColor = UIColor(appearance.ui.surfaceGlass).withAlphaComponent(0.98)
        stackContainer.removeAllChildren()

        // 1. Trump card underneath — FACE DOWN with Trump Suit Emblem badge
        if let trump = trumpCard {
            if trumpCardNode?.card != trump {
                trumpCardNode?.removeFromParent()
                // Render card face-down (back pattern)
                let node = CardNode(card: trump, isFaceUp: false, size: cardSize, appearance: appearance)
                node.zRotation = .pi / 2
                node.zPosition = 1
                node.position = CGPoint(x: cardSize.height * 0.22, y: 0)
                addChild(node)
                self.trumpCardNode = node
            } else {
                trumpCardNode?.updateAppearance(appearance)
            }
            trumpCardNode?.isHidden = false

            // Update trump suit badge
            trumpSuitBadge.isHidden = false
            let suitSymbol: String
            let suitColor: UIColor
            switch trump.suit {
            case .spades:
                suitSymbol = "♠"
                suitColor = UIColor(DesignTokens.Colors.textLight)
            case .hearts:
                suitSymbol = "♥"
                suitColor = UIColor(DesignTokens.Colors.redCard)
            case .diamonds:
                suitSymbol = "♦"
                suitColor = UIColor(DesignTokens.Colors.redCard)
            case .clubs:
                suitSymbol = "♣"
                suitColor = UIColor(DesignTokens.Colors.textLight)
            }
            trumpSuitLabel.text = suitSymbol
            trumpSuitLabel.fontColor = suitColor
            trumpSuitBadge.position = CGPoint(x: 42, y: 0)
        } else {
            trumpCardNode?.isHidden = true
            trumpSuitBadge.isHidden = true
        }

        // 2. Stack of face-down cards
        // If deckCount > 1, show stack on top of trump
        let stackCount = max(0, deckCount - (trumpCard != nil ? 1 : 0))
        if stackCount > 0 {
            let visibleLayers = min(stackCount, 4)
            for i in 0..<visibleLayers {
                let offset = CGFloat(i) * 1.5
                let backNode = CardNode(card: Card(suit: .spades, rank: .ace), isFaceUp: false, size: cardSize, appearance: appearance)
                backNode.position = CGPoint(x: -offset, y: offset)
                backNode.zPosition = CGFloat(5 + i)
                stackContainer.addChild(backNode)
            }
        }

        // 3. Count badge
        countLabel.text = "\(deckCount)"
        countBadgeNode.isHidden = deckCount <= 0
        countBadgeNode.position = CGPoint(x: -4, y: 0)
    }
}
