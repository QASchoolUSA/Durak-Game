import SpriteKit
import DurakGameCore
import SwiftUI

/// A native SpriteKit node representing a playing card with dynamic vector rendering,
/// flip animations, and glow highlights.
final class CardNode: SKNode {
    let card: Card
    private(set) var isFaceUp: Bool
    var cardSize: CGSize
    private var appearance: AppearancePreset

    var isPlayable: Bool = false {
        didSet { updateGlow() }
    }

    var originalPosition: CGPoint = .zero
    var originalZPosition: CGFloat = 0
    var originalRotation: CGFloat = 0

    private let containerNode = SKNode()
    private var shadowNode: SKShapeNode?
    private var frontNode: SKNode?
    private var backNode: SKNode?
    private var glowNode: SKShapeNode?
    private(set) var isLifted: Bool = false

    init(card: Card, isFaceUp: Bool = true, size: CGSize = CGSize(width: 72, height: 101), appearance: AppearancePreset = getAppearance(.green)) {
        self.card = card
        self.isFaceUp = isFaceUp
        self.cardSize = size
        self.appearance = appearance
        super.init()

        addChild(containerNode)
        renderCard()
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func updateAppearance(_ appearance: AppearancePreset) {
        self.appearance = appearance
        renderCard()
    }

    func updateSize(_ newSize: CGSize) {
        guard newSize != cardSize else { return }
        self.cardSize = newSize
        renderCard()
    }

    private func renderCard() {
        containerNode.removeAllChildren()
        buildShadowNode()
        frontNode = buildFrontNode()
        backNode = buildBackNode()

        if let front = frontNode {
            front.isHidden = !isFaceUp
            containerNode.addChild(front)
        }
        if let back = backNode {
            back.isHidden = isFaceUp
            containerNode.addChild(back)
        }

        buildGlowNode()
    }

    private func buildShadowNode() {
        shadowNode?.removeFromParent()
        let rect = CGRect(origin: CGPoint(x: -cardSize.width / 2, y: -cardSize.height / 2), size: cardSize)
        let shadow = SKShapeNode(rect: rect, cornerRadius: 8)
        shadow.fillColor = UIColor.black.withAlphaComponent(0.24)
        shadow.strokeColor = UIColor.clear
        shadow.position = CGPoint(x: 0, y: -2)
        shadow.xScale = 0.98
        shadow.yScale = 0.98
        shadow.zPosition = -1
        addChild(shadow)
        self.shadowNode = shadow
    }

    // MARK: - Front Face

    private func buildFrontNode() -> SKNode {
        let node = SKNode()
        let rect = CGRect(origin: CGPoint(x: -cardSize.width / 2, y: -cardSize.height / 2), size: cardSize)
        let cornerRadius: CGFloat = 8

        // Card base
        let base = SKShapeNode(rect: rect, cornerRadius: cornerRadius)
        base.fillColor = UIColor(appearance.card.face)
        base.strokeColor = UIColor(appearance.card.faceEdge)
        base.lineWidth = 1.0
        node.addChild(base)

        // Suit color
        let isRed = card.suit == .hearts || card.suit == .diamonds
        let suitColor: UIColor = isRed ? UIColor(DesignTokens.Colors.redCard) : UIColor(DesignTokens.Colors.blackCard)

        // Rank text
        let rankString = rankSymbol(card.rank)
        let suitString = suitSymbol(card.suit)

        // Top-left rank & suit
        let tlRank = SKLabelNode(text: rankString)
        tlRank.fontName = "HelveticaNeue-Bold"
        tlRank.fontSize = cardSize.width * 0.19
        tlRank.fontColor = suitColor
        tlRank.horizontalAlignmentMode = .left
        tlRank.verticalAlignmentMode = .top
        tlRank.position = CGPoint(x: rect.minX + 5, y: rect.maxY - 4)
        node.addChild(tlRank)

        let tlSuit = SKLabelNode(text: suitString)
        tlSuit.fontName = "HelveticaNeue-Bold"
        tlSuit.fontSize = cardSize.width * 0.16
        tlSuit.fontColor = suitColor
        tlSuit.horizontalAlignmentMode = .left
        tlSuit.verticalAlignmentMode = .top
        tlSuit.position = CGPoint(x: rect.minX + 5, y: rect.maxY - 4 - tlRank.fontSize * 1.05)
        node.addChild(tlSuit)

        // Bottom-right rank & suit (rotated 180°)
        let brRank = SKLabelNode(text: rankString)
        brRank.fontName = "HelveticaNeue-Bold"
        brRank.fontSize = cardSize.width * 0.19
        brRank.fontColor = suitColor
        brRank.horizontalAlignmentMode = .left
        brRank.verticalAlignmentMode = .top
        brRank.position = CGPoint(x: rect.maxX - 5, y: rect.minY + 4)
        brRank.zRotation = .pi
        node.addChild(brRank)

        let brSuit = SKLabelNode(text: suitString)
        brSuit.fontName = "HelveticaNeue-Bold"
        brSuit.fontSize = cardSize.width * 0.16
        brSuit.fontColor = suitColor
        brSuit.horizontalAlignmentMode = .left
        brSuit.verticalAlignmentMode = .top
        brSuit.position = CGPoint(x: rect.maxX - 5, y: rect.minY + 4 + brRank.fontSize * 1.05)
        brSuit.zRotation = .pi
        node.addChild(brSuit)

        // Center Suit symbol
        let centerSuit = SKLabelNode(text: suitString)
        centerSuit.fontName = "HelveticaNeue-Bold"
        centerSuit.fontSize = cardSize.width * 0.42
        centerSuit.fontColor = suitColor.withAlphaComponent(0.92)
        centerSuit.horizontalAlignmentMode = .center
        centerSuit.verticalAlignmentMode = .center
        centerSuit.position = .zero
        node.addChild(centerSuit)

        return node
    }

    // MARK: - Back Face

    private func buildBackNode() -> SKNode {
        let node = SKNode()
        let rect = CGRect(origin: CGPoint(x: -cardSize.width / 2, y: -cardSize.height / 2), size: cardSize)
        let cornerRadius: CGFloat = 8

        // Back base
        let base = SKShapeNode(rect: rect, cornerRadius: cornerRadius)
        base.fillColor = UIColor(appearance.card.back)
        base.strokeColor = UIColor(appearance.card.backAccent)
        base.lineWidth = 1.5
        node.addChild(base)

        // Inner ornamental border
        let innerRect = rect.insetBy(dx: 4, dy: 4)
        let innerBorder = SKShapeNode(rect: innerRect, cornerRadius: cornerRadius - 2)
        innerBorder.fillColor = UIColor.clear
        innerBorder.strokeColor = UIColor(appearance.card.backAccent).withAlphaComponent(0.6)
        innerBorder.lineWidth = 1.0
        node.addChild(innerBorder)

        // Center emblem
        let centerEmblem = SKShapeNode(circleOfRadius: cardSize.width * 0.22)
        centerEmblem.fillColor = UIColor(appearance.card.backAccent).withAlphaComponent(0.2)
        centerEmblem.strokeColor = UIColor(appearance.card.backAccent)
        centerEmblem.lineWidth = 1.0
        centerEmblem.position = .zero
        node.addChild(centerEmblem)

        let starLabel = SKLabelNode(text: "✦")
        starLabel.fontName = "HelveticaNeue-Bold"
        starLabel.fontSize = cardSize.width * 0.25
        starLabel.fontColor = UIColor(appearance.card.backAccent)
        starLabel.horizontalAlignmentMode = .center
        starLabel.verticalAlignmentMode = .center
        starLabel.position = CGPoint(x: 0, y: -1)
        node.addChild(starLabel)

        return node
    }

    // MARK: - Glow

    private func buildGlowNode() {
        glowNode?.removeFromParent()
        let rect = CGRect(origin: CGPoint(x: -cardSize.width / 2 - 2, y: -cardSize.height / 2 - 2),
                          size: CGSize(width: cardSize.width + 4, height: cardSize.height + 4))
        let glow = SKShapeNode(rect: rect, cornerRadius: 10)
        glow.strokeColor = UIColor(appearance.ui.accent)
        glow.fillColor = UIColor.clear
        glow.lineWidth = 3
        glow.glowWidth = 4
        glow.alpha = 0
        glow.isHidden = true
        containerNode.addChild(glow)
        self.glowNode = glow
    }

    private func updateGlow() {
        guard let glow = glowNode else { return }
        glow.removeAllActions()
        if isPlayable {
            glow.isHidden = false
            let pulseUp = SKAction.fadeAlpha(to: 0.9, duration: 0.6)
            let pulseDown = SKAction.fadeAlpha(to: 0.3, duration: 0.6)
            let sequence = SKAction.sequence([pulseUp, pulseDown])
            glow.run(SKAction.repeatForever(sequence))
        } else {
            glow.alpha = 0
            glow.isHidden = true
        }
    }

    // MARK: - Elevation & Physics

    func setLifted(_ lifted: Bool, animated: Bool = true) {
        self.isLifted = lifted
        let duration: TimeInterval = animated ? (lifted ? 0.16 : 0.20) : 0.0

        let targetScale: CGFloat = lifted ? 1.10 : 1.0
        let targetShadowPos: CGPoint = lifted ? CGPoint(x: 0, y: -16) : CGPoint(x: 0, y: -2)
        let targetShadowScale: CGFloat = lifted ? 1.14 : 0.98
        let targetShadowAlpha: CGFloat = lifted ? 0.42 : 0.24

        if animated {
            let cardScaleAction = SKAction.scale(to: targetScale, duration: duration)
            cardScaleAction.timingMode = .easeOut
            containerNode.run(cardScaleAction)

            if let shadow = shadowNode {
                let moveShadow = SKAction.move(to: targetShadowPos, duration: duration)
                moveShadow.timingMode = .easeOut
                let scaleShadow = SKAction.scale(to: targetShadowScale, duration: duration)
                scaleShadow.timingMode = .easeOut
                let fadeShadow = SKAction.fadeAlpha(to: targetShadowAlpha, duration: duration)
                fadeShadow.timingMode = .easeOut
                shadow.run(SKAction.group([moveShadow, scaleShadow, fadeShadow]))
            }
        } else {
            containerNode.setScale(targetScale)
            shadowNode?.position = targetShadowPos
            shadowNode?.setScale(targetShadowScale)
            shadowNode?.alpha = targetShadowAlpha
        }
    }

    // MARK: - Animations

    func flip(toFaceUp: Bool, duration: TimeInterval = 0.25, completion: (() -> Void)? = nil) {
        guard isFaceUp != toFaceUp else {
            completion?()
            return
        }

        let halfDuration = duration / 2
        let scaleDown = SKAction.scaleX(to: 0.05, duration: halfDuration)
        let swap = SKAction.run { [weak self] in
            guard let self else { return }
            self.isFaceUp = toFaceUp
            self.frontNode?.isHidden = !toFaceUp
            self.backNode?.isHidden = toFaceUp
        }
        let scaleUp = SKAction.scaleX(to: 1.0, duration: halfDuration)
        let seq = SKAction.sequence([scaleDown, swap, scaleUp])

        containerNode.run(seq) {
            completion?()
        }
    }

    func flyTo(position: CGPoint, rotation: CGFloat = 0, zPosition: CGFloat? = nil, scale: CGFloat? = nil, duration: TimeInterval = 0.28, completion: (() -> Void)? = nil) {
        if let z = zPosition {
            self.zPosition = z
        }
        let effectiveDuration = UIAccessibility.isReduceMotionEnabled ? 0 : duration
        removeAction(forKey: "flyTo")
        removeAction(forKey: "flyToCompletion")
        let move = SKAction.move(to: position, duration: effectiveDuration)

        move.timingMode = .easeOut
        let rotate = SKAction.rotate(toAngle: rotation, duration: effectiveDuration)
        rotate.timingMode = .easeOut
        var actions: [SKAction] = [move, rotate]
        if let s = scale {
            let scaleAct = SKAction.scale(to: s, duration: effectiveDuration)
            scaleAct.timingMode = .easeOut
            actions.append(scaleAct)
        }
        let group = SKAction.group(actions)

        run(group, withKey: "flyTo")
        if effectiveDuration <= 0 {
            completion?()
        } else {
            run(SKAction.sequence([
                SKAction.wait(forDuration: effectiveDuration),
                SKAction.run { completion?() }
            ]), withKey: "flyToCompletion")
        }
    }

    // MARK: - Helpers

    private func rankSymbol(_ rank: Rank) -> String {
        switch rank {
        case .six: return "6"
        case .seven: return "7"
        case .eight: return "8"
        case .nine: return "9"
        case .ten: return "10"
        case .jack: return "J"
        case .queen: return "Q"
        case .king: return "K"
        case .ace: return "A"
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
