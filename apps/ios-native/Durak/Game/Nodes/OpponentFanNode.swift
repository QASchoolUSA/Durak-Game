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
        trackRing.lineWidth = 2.0
        trackRing.fillColor = .clear
        trackRing.isHidden = true
        container.addChild(trackRing)

        activeRing.lineWidth = 2.8
        activeRing.lineCap = .round
        activeRing.fillColor = .clear
        activeRing.isHidden = true
        container.addChild(activeRing)

        avatarCircle.lineWidth = 1.5
        container.addChild(avatarCircle)

        let initialLabel = SKLabelNode(text: String(name.prefix(1).uppercased()))
        initialLabel.name = "initialLabel"
        initialLabel.fontName = "HelveticaNeue-Bold"
        initialLabel.fontSize = 16
        initialLabel.verticalAlignmentMode = .center
        initialLabel.horizontalAlignmentMode = .center
        avatarCircle.addChild(initialLabel)

        nameLabel.text = name
        nameLabel.fontName = "HelveticaNeue-Medium"
        nameLabel.fontSize = 11
        nameLabel.horizontalAlignmentMode = .center
        nameLabel.verticalAlignmentMode = .top
        nameLabel.position = CGPoint(x: 0, y: -34)
        container.addChild(nameLabel)

        roleLabel.fontName = "HelveticaNeue-Bold"
        roleLabel.fontSize = 9
        roleLabel.horizontalAlignmentMode = .center
        roleLabel.verticalAlignmentMode = .top
        roleLabel.position = CGPoint(x: 0, y: -48)
        container.addChild(roleLabel)

        cardCountBadge.lineWidth = 1
        cardCountBadge.position = CGPoint(x: 18, y: 16)
        container.addChild(cardCountBadge)

        cardCountLabel.fontName = "HelveticaNeue-Bold"
        cardCountLabel.fontSize = 10
        cardCountLabel.horizontalAlignmentMode = .center
        cardCountLabel.verticalAlignmentMode = .center
        cardCountBadge.addChild(cardCountLabel)

        applyThemeColors()
    }

    /// Reapplies avatar / ring / badge / role colors from the current appearance (mid-match theme switch).
    private func applyThemeColors() {
        let accent = UIColor(appearance.ui.accent)
        trackRing.strokeColor = accent.withAlphaComponent(0.18)
        activeRing.strokeColor = accent
        avatarCircle.fillColor = UIColor(appearance.ui.surfaceGlass)
        avatarCircle.strokeColor = accent.withAlphaComponent(0.5)
        roleLabel.fontColor = accent
        cardCountBadge.fillColor = UIColor(appearance.ui.surfaceCard)
        cardCountBadge.strokeColor = accent

        let ink = UIColor(DesignTokens.Colors.textLight)
        nameLabel.fontColor = ink
        cardCountLabel.fontColor = ink
        if let initial = avatarCircle.childNode(withName: "initialLabel") as? SKLabelNode {
            initial.fontColor = ink
        }
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
        let themeChanged = self.appearance.id != appearance.id
        self.cardCount = cardCount
        self.isCurrentTurn = isCurrentTurn && !finished
        let outLabel = String(localized: "OUT")
        self.role = finished ? outLabel : role
        self.appearance = appearance

        if themeChanged {
            applyThemeColors()
        }

        cardCountLabel.text = finished ? outLabel : "🂠 \(cardCount)"
        roleLabel.text = (finished ? outLabel : role)?.uppercased() ?? ""
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

        // ~15 Hz path updates instead of every frame (avoids CGPath tessellation spam).
        let tick: TimeInterval = 1.0 / 15.0
        let ticks = max(1, Int(ceil(duration / tick)))
        var actions: [SKAction] = []
        for i in 0..<ticks {
            let t = min(1.0, Double(i) * tick / duration)
            let progress = max(0.0, startProgress * (1.0 - t))
            actions.append(SKAction.run { [weak self] in
                self?.updateRingPath(progress: progress)
            })
            actions.append(SKAction.wait(forDuration: tick))
        }
        actions.append(SKAction.run { [weak self] in
            self?.stopTurnTimer()
        })

        activeRing.run(SKAction.sequence(actions), withKey: "turnTimer")
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
