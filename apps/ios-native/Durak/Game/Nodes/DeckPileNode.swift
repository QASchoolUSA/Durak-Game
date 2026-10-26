import SpriteKit
import DurakGameCore
import SwiftUI

/// Draw-pile cluster: upright face-down stack with top-left remaining-count badge and horizontal face-up trump card peeking out.
/// When one card remains, that trump is shown upright alone (no badge). When the deck is exhausted
/// (`deckCount == 0`), a permanent Trump Suit indicator remains on the felt.
final class DeckPileNode: SKNode {
    private var trumpCardNode: CardNode?
    private let stackContainer = SKNode()
    private var stackBackNodes: [CardNode] = []
    private let countBadgeNode = SKNode()
    private let countLabel = SKLabelNode()
    private let badgeBg = SKShapeNode(rectOf: CGSize(width: 28, height: 22), cornerRadius: 11)

    /// Persistent trump-suit emblem shown on the felt once the draw pile is empty.
    private let emptyTrumpIndicator = SKNode()
    private let emptyTrumpFrame: SKShapeNode
    private let emptyTrumpSuitLabel = SKLabelNode()
    private let emptyTrumpCaptionLabel = SKLabelNode()

    private var appearance: AppearancePreset
    private var cardSize: CGSize
    /// True while presenting the final draw-pile card as a centered upright face-up trump.
    private var isShowingSoloLastCard = false
    private let soloRevealActionKey = "soloReveal"

    init(appearance: AppearancePreset, cardSize: CGSize = CGSize(width: 56, height: 80)) {
        self.appearance = appearance
        self.cardSize = cardSize
        self.emptyTrumpFrame = SKShapeNode(rectOf: cardSize, cornerRadius: 8)
        super.init()

        stackContainer.zPosition = 5
        addChild(stackContainer)
        setupStackPool()
        setupBadge()
        setupEmptyTrumpIndicator()
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupStackPool() {
        for i in 0..<4 {
            let offset = CGFloat(i) * 1.5
            let backNode = CardNode(
                card: Card(suit: .spades, rank: .ace),
                isFaceUp: false,
                size: cardSize,
                appearance: appearance
            )
            backNode.position = CGPoint(x: -offset, y: offset)
            backNode.zPosition = CGFloat(i)
            backNode.isHidden = true
            stackContainer.addChild(backNode)
            stackBackNodes.append(backNode)
        }
    }

    private func setupBadge() {
        badgeBg.fillColor = UIColor(appearance.ui.surfaceCard).withAlphaComponent(0.96)
        badgeBg.strokeColor = UIColor(appearance.ui.accent)
        badgeBg.lineWidth = 1.5
        countBadgeNode.addChild(badgeBg)

        countLabel.fontName = "HelveticaNeue-Bold"
        countLabel.fontSize = 12
        countLabel.fontColor = UIColor(appearance.ui.accent)
        countLabel.horizontalAlignmentMode = .center
        countLabel.verticalAlignmentMode = .center
        countBadgeNode.addChild(countLabel)

        countBadgeNode.zPosition = 60
        addChild(countBadgeNode)
    }

    private func setupEmptyTrumpIndicator() {
        emptyTrumpFrame.fillColor = UIColor(appearance.ui.surfaceGlass).withAlphaComponent(0.68)
        emptyTrumpFrame.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.55)
        emptyTrumpFrame.lineWidth = 1.5
        emptyTrumpIndicator.addChild(emptyTrumpFrame)

        emptyTrumpSuitLabel.fontName = "HelveticaNeue-Bold"
        emptyTrumpSuitLabel.fontSize = 26
        emptyTrumpSuitLabel.horizontalAlignmentMode = .center
        emptyTrumpSuitLabel.verticalAlignmentMode = .center
        emptyTrumpSuitLabel.position = CGPoint(x: 0, y: 6)
        emptyTrumpIndicator.addChild(emptyTrumpSuitLabel)

        emptyTrumpCaptionLabel.text = String(localized: "TRUMP")
        emptyTrumpCaptionLabel.fontName = "HelveticaNeue-Bold"
        emptyTrumpCaptionLabel.fontSize = 8.5
        emptyTrumpCaptionLabel.fontColor = UIColor(appearance.ui.accent)
        emptyTrumpCaptionLabel.horizontalAlignmentMode = .center
        emptyTrumpCaptionLabel.verticalAlignmentMode = .center
        emptyTrumpCaptionLabel.position = CGPoint(x: 0, y: -18)
        emptyTrumpIndicator.addChild(emptyTrumpCaptionLabel)

        emptyTrumpIndicator.zPosition = 2
        emptyTrumpIndicator.isHidden = true
        addChild(emptyTrumpIndicator)
    }

    func update(deckCount: Int, trumpCard: Card?, trumpSuit: Suit? = nil, appearance: AppearancePreset) {
        let themeChanged = self.appearance.id != appearance.id
        self.appearance = appearance
        if themeChanged {
            badgeBg.strokeColor = UIColor(appearance.ui.accent)
            badgeBg.fillColor = UIColor(appearance.ui.surfaceCard).withAlphaComponent(0.96)
            countLabel.fontColor = UIColor(appearance.ui.accent)
            emptyTrumpFrame.fillColor = UIColor(appearance.ui.surfaceGlass).withAlphaComponent(0.68)
            emptyTrumpFrame.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.55)
            emptyTrumpCaptionLabel.fontColor = UIColor(appearance.ui.accent)
        }

        let showCluster = deckCount > 0
        let isSoloLastCard = deckCount == 1 && trumpCard != nil
        let resolvedSuit = trumpSuit ?? trumpCard?.suit
        let peekPosition = CGPoint(x: cardSize.height * 0.44, y: 0)

        // 1. Trump — peek under the stack when multiple cards remain; upright solo when one remains.
        if let trump = trumpCard, showCluster {
            let needsNewNode = trumpCardNode == nil
                || trumpCardNode?.card != trump
                || trumpCardNode?.isFaceUp != true

            if needsNewNode {
                trumpCardNode?.removeAction(forKey: soloRevealActionKey)
                trumpCardNode?.removeFromParent()
                let node = CardNode(card: trump, isFaceUp: true, size: cardSize, appearance: appearance)
                node.zPosition = isSoloLastCard ? 10 : 1
                if isSoloLastCard {
                    applySoloPresentation(to: node, animated: false)
                } else {
                    applyPeekPresentation(to: node, at: peekPosition)
                }
                addChild(node)
                trumpCardNode = node
                isShowingSoloLastCard = isSoloLastCard
            } else if let node = trumpCardNode {
                node.updateAppearance(appearance)
                node.isHidden = false
                node.zPosition = isSoloLastCard ? 10 : 1

                if isSoloLastCard {
                    let enteringSolo = !isShowingSoloLastCard
                    applySoloPresentation(to: node, animated: enteringSolo)
                    isShowingSoloLastCard = true
                } else {
                    node.removeAction(forKey: soloRevealActionKey)
                    applyPeekPresentation(to: node, at: peekPosition)
                    isShowingSoloLastCard = false
                }
            }
        } else {
            trumpCardNode?.removeAction(forKey: soloRevealActionKey)
            trumpCardNode?.isHidden = true
            isShowingSoloLastCard = false
        }

        // 2. Upright face-down draw stack (reuses pre-built pool nodes; star/emblem remains visible in center)
        let stackCount = max(0, deckCount - (trumpCard != nil ? 1 : 0))
        let visibleLayers = min(stackCount, stackBackNodes.count)
        for (i, backNode) in stackBackNodes.enumerated() {
            if i < visibleLayers {
                if themeChanged {
                    backNode.updateAppearance(appearance)
                }
                backNode.isHidden = false
            } else {
                backNode.isHidden = true
            }
        }

        // 3. Remaining-count badge — only when 2+ cards remain (solo last card needs no counter).
        countLabel.text = "\(deckCount)"
        countBadgeNode.isHidden = deckCount < 2
        countBadgeNode.position = CGPoint(
            x: -cardSize.width * 0.50 - 2,
            y: cardSize.height * 0.50 - 2
        )

        // 4. Empty-deck Trump Suit indicator — always visible when deckCount == 0 so players know the trump suit
        if !showCluster, let suit = resolvedSuit {
            emptyTrumpSuitLabel.text = suitSymbol(suit)
            let isRed = (suit == .hearts || suit == .diamonds)
            emptyTrumpSuitLabel.fontColor = isRed
                ? UIColor(appearance.card.suitRed)
                : UIColor(appearance.card.suitBlack)
            emptyTrumpIndicator.isHidden = false
        } else {
            emptyTrumpIndicator.isHidden = true
        }
    }

    private func applyPeekPresentation(to node: CardNode, at peekPosition: CGPoint) {
        // Face-up trump rotated -90° so the top-left corner index sits to the right of the stack.
        node.zRotation = -.pi / 2
        node.centerSuitRotation = 0
        node.centerSuitOffset = CGPoint(x: 0, y: 8)
        node.position = peekPosition
        node.isHidden = false
    }

    private func applySoloPresentation(to node: CardNode, animated: Bool) {
        node.centerSuitRotation = 0
        node.centerSuitOffset = .zero
        node.isHidden = false

        let reduce = UIAccessibility.isReduceMotionEnabled
        if animated && !reduce {
            let duration: TimeInterval = 0.32
            let move = SKAction.move(to: .zero, duration: duration)
            let rotate = SKAction.rotate(toAngle: 0, duration: duration, shortestUnitArc: true)
            move.timingMode = .easeInEaseOut
            rotate.timingMode = .easeInEaseOut
            node.run(SKAction.group([move, rotate]), withKey: soloRevealActionKey)
        } else {
            node.removeAction(forKey: soloRevealActionKey)
            node.zRotation = 0
            node.position = .zero
        }
    }

    private func suitSymbol(_ suit: Suit) -> String {
        switch suit {
        case .spades: return "♠"
        case .hearts: return "♥"
        case .diamonds: return "♦"
        case .clubs: return "♣"
        }
    }
}
