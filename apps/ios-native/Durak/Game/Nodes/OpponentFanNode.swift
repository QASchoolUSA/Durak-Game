import SpriteKit
import DurakGameCore
import SwiftUI

/// Node displaying an opponent seat with avatar, name, card count fan, and role indicator.
final class OpponentFanNode: SKNode {
    let playerId: String
    private var cardCount: Int = 0
    private var isCurrentTurn: Bool = false
    private var role: String? = nil
    private var appearance: AppearancePreset

    private let container = SKNode()
    private let avatarCircle = SKShapeNode(circleOfRadius: 22)
    private let nameLabel = SKLabelNode()
    private let roleLabel = SKLabelNode()
    private let cardCountBadge = SKShapeNode(rectOf: CGSize(width: 32, height: 18), cornerRadius: 9)
    private let cardCountLabel = SKLabelNode()
    private let trackRing = SKShapeNode(circleOfRadius: 26)
    private let activeRing = SKShapeNode()

    init(playerId: String, playerName: String, appearance: AppearancePreset) {
        self.playerId = playerId
        self.appearance = appearance
        super.init()

        addChild(container)
        setupVisuals(name: playerName)
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupVisuals(name: String) {
        // Track ring guide (faint background)
        trackRing.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.18)
        trackRing.lineWidth = 2.0
        trackRing.fillColor = .clear
        trackRing.isHidden = true
        container.addChild(trackRing)

        // Active turn countdown ring
        activeRing.strokeColor = UIColor(appearance.ui.accent)
        activeRing.lineWidth = 2.8
        activeRing.lineCap = .round
        activeRing.fillColor = .clear
        activeRing.isHidden = true
        container.addChild(activeRing)

        // Avatar circle
        avatarCircle.fillColor = UIColor(appearance.ui.surfaceGlass)
        avatarCircle.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.5)
        avatarCircle.lineWidth = 1.5
        container.addChild(avatarCircle)

        // Initial in avatar
        let initialLabel = SKLabelNode(text: String(name.prefix(1).uppercased()))
        initialLabel.fontName = "HelveticaNeue-Bold"
        initialLabel.fontSize = 16
        initialLabel.fontColor = UIColor(DesignTokens.Colors.textLight)
        initialLabel.verticalAlignmentMode = .center
        initialLabel.horizontalAlignmentMode = .center
        avatarCircle.addChild(initialLabel)

        // Name label — comfortably spaced below avatar ring
        nameLabel.text = name
        nameLabel.fontName = "HelveticaNeue-Medium"
        nameLabel.fontSize = 11
        nameLabel.fontColor = UIColor(DesignTokens.Colors.textLight)
        nameLabel.horizontalAlignmentMode = .center
        nameLabel.verticalAlignmentMode = .top
        nameLabel.position = CGPoint(x: 0, y: -34)
        container.addChild(nameLabel)

        // Role label
        roleLabel.fontName = "HelveticaNeue-Bold"
        roleLabel.fontSize = 9
        roleLabel.fontColor = UIColor(appearance.ui.accent)
        roleLabel.horizontalAlignmentMode = .center
        roleLabel.verticalAlignmentMode = .top
        roleLabel.position = CGPoint(x: 0, y: -48)
        container.addChild(roleLabel)

        // Card count badge
        cardCountBadge.fillColor = UIColor(appearance.ui.surfaceCard)
        cardCountBadge.strokeColor = UIColor(appearance.ui.accent)
        cardCountBadge.lineWidth = 1
        cardCountBadge.position = CGPoint(x: 18, y: 16)
        container.addChild(cardCountBadge)

        cardCountLabel.fontName = "HelveticaNeue-Bold"
        cardCountLabel.fontSize = 10
        cardCountLabel.fontColor = UIColor(DesignTokens.Colors.textLight)
        cardCountLabel.horizontalAlignmentMode = .center
        cardCountLabel.verticalAlignmentMode = .center
        cardCountBadge.addChild(cardCountLabel)
    }

    func update(
        cardCount: Int,
        isCurrentTurn: Bool,
        role: String?,
        appearance: AppearancePreset,
        finished: Bool = false,
        turnDeadlineAt: Date? = nil,
        turnTimerSeconds: TimeInterval = 12
    ) {
        let turnChanged = self.isCurrentTurn != isCurrentTurn
        self.cardCount = cardCount
        self.isCurrentTurn = isCurrentTurn && !finished
        self.role = finished ? "OUT" : role
        self.appearance = appearance

        cardCountLabel.text = finished ? "OUT" : "🂠 \(cardCount)"
        roleLabel.text = (finished ? "OUT" : role)?.uppercased() ?? ""
        roleLabel.isHidden = self.role == nil

        container.alpha = finished ? 0.45 : 1.0

        if finished {
            stopTurnTimer()
            return
        }

        if self.isCurrentTurn {
            let remaining: TimeInterval
            if let deadline = turnDeadlineAt {
                remaining = max(0.5, deadline.timeIntervalSinceNow)
            } else {
                remaining = turnTimerSeconds
            }
            if turnChanged || activeRing.action(forKey: "turnTimer") == nil {
                startTurnTimer(duration: remaining, totalDuration: turnTimerSeconds)
            }
        } else {
            stopTurnTimer()
        }
    }

    private func startTurnTimer(duration: TimeInterval, totalDuration: TimeInterval) {
        trackRing.isHidden = false
        activeRing.isHidden = false
        activeRing.removeAllActions()

        let total = max(duration, totalDuration)
        let startProgress = min(1.0, duration / total)
        updateRingPath(progress: startProgress)

        let countdownAction = SKAction.customAction(withDuration: duration) { [weak self] _, elapsedTime in
            guard let self else { return }
            let progress = max(0.0, startProgress * (1.0 - (Double(elapsedTime) / duration)))
            self.updateRingPath(progress: progress)
        }

        let completeAction = SKAction.run { [weak self] in
            self?.stopTurnTimer()
        }

        activeRing.run(SKAction.sequence([countdownAction, completeAction]), withKey: "turnTimer")
    }

    private func stopTurnTimer() {
        activeRing.removeAction(forKey: "turnTimer")
        activeRing.path = nil
        activeRing.isHidden = true
        trackRing.isHidden = true
    }

    private func updateRingPath(progress: Double) {
        guard progress > 0.001 else {
            activeRing.path = nil
            activeRing.isHidden = true
            return
        }

        let path = UIBezierPath()
        let startAngle: CGFloat = .pi / 2 // 12 o'clock top
        let endAngle: CGFloat = .pi / 2 - CGFloat(progress * 2.0 * .pi)
        path.addArc(withCenter: .zero, radius: 26, startAngle: startAngle, endAngle: endAngle, clockwise: false)

        activeRing.path = path.cgPath
        activeRing.isHidden = false

        // Role-based color coding: Attacking = Red, Defending = Theme Accent
        let roleColor: UIColor
        if role?.lowercased().contains("attack") == true {
            roleColor = UIColor(DesignTokens.Colors.danger) // Red
        } else if role?.lowercased().contains("defend") == true {
            roleColor = UIColor(appearance.ui.accent)
        } else {
            roleColor = UIColor(appearance.ui.accent)
        }

        activeRing.strokeColor = roleColor
        trackRing.strokeColor = roleColor.withAlphaComponent(0.20)
    }
}
