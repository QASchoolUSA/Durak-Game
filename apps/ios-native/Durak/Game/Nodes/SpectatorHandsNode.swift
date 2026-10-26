import SpriteKit
import DurakGameCore
import SwiftUI

/// Responsive seating recipes for solo-spectator face-up hands.
/// Compact phones use a 2-row grid at 4–5 remaining; wide pads stay 1-row until R=5.
private enum SpectatorLayout {
    struct SeatAnchor {
        /// X as fraction of viewport width (0…1).
        let xFraction: CGFloat
        /// Row index: 0 = single/middle, +1 = top row, −1 = bottom row.
        let row: Int
    }

    struct Recipe {
        let seats: [SeatAnchor]
        let cardSize: CGSize
        let rowCount: Int
    }

    static let minGutter: CGFloat = 16
    static let minCardSpacing: CGFloat = 7
    static let nameMaxChars = 10
    static let containerMoveThreshold: CGFloat = 0.75
    static let cardMoveThreshold: CGFloat = 0.75
    static let rotationThreshold: CGFloat = 0.01
    static let reflowDuration: TimeInterval = 0.28
    /// Minimum center-to-center gap so TL rank/suit stays identifiable.
    static func minPeekSpacing(cardWidth: CGFloat) -> CGFloat {
        max(11, cardWidth * 0.22)
    }

    static func maxFitAtPeek(maxHalfWidth: CGFloat, cardWidth: CGFloat) -> Int {
        let maxSpan = max(0, 2 * maxHalfWidth - cardWidth)
        let peek = minPeekSpacing(cardWidth: cardWidth)
        guard peek > 0 else { return 1 }
        return max(1, 1 + Int(floor(maxSpan / peek)))
    }

    static func recipe(forRemaining count: Int, isWide: Bool) -> Recipe {
        let r = max(1, min(count, 5))
        if isWide {
            return wideRecipe(r)
        }
        return compactRecipe(r)
    }

    private static func compactRecipe(_ r: Int) -> Recipe {
        switch r {
        case 1:
            return Recipe(
                seats: [SeatAnchor(xFraction: 0.50, row: 0)],
                cardSize: CGSize(width: 58, height: 80),
                rowCount: 1
            )
        case 2:
            return Recipe(
                seats: [
                    SeatAnchor(xFraction: 0.28, row: 0),
                    SeatAnchor(xFraction: 0.72, row: 0),
                ],
                cardSize: CGSize(width: 56, height: 78),
                rowCount: 1
            )
        case 3:
            return Recipe(
                seats: [
                    SeatAnchor(xFraction: 0.18, row: 0),
                    SeatAnchor(xFraction: 0.50, row: 0),
                    SeatAnchor(xFraction: 0.82, row: 0),
                ],
                cardSize: CGSize(width: 50, height: 70),
                rowCount: 1
            )
        case 4:
            // 2+2 grid
            return Recipe(
                seats: [
                    SeatAnchor(xFraction: 0.30, row: 1),
                    SeatAnchor(xFraction: 0.70, row: 1),
                    SeatAnchor(xFraction: 0.30, row: -1),
                    SeatAnchor(xFraction: 0.70, row: -1),
                ],
                cardSize: CGSize(width: 48, height: 66),
                rowCount: 2
            )
        default:
            // 3 top + 2 bottom centered
            return Recipe(
                seats: [
                    SeatAnchor(xFraction: 0.18, row: 1),
                    SeatAnchor(xFraction: 0.50, row: 1),
                    SeatAnchor(xFraction: 0.82, row: 1),
                    SeatAnchor(xFraction: 0.32, row: -1),
                    SeatAnchor(xFraction: 0.68, row: -1),
                ],
                cardSize: CGSize(width: 44, height: 62),
                rowCount: 2
            )
        }
    }

    private static func wideRecipe(_ r: Int) -> Recipe {
        switch r {
        case 1:
            return Recipe(
                seats: [SeatAnchor(xFraction: 0.50, row: 0)],
                cardSize: CGSize(width: 64, height: 90),
                rowCount: 1
            )
        case 2:
            return Recipe(
                seats: [
                    SeatAnchor(xFraction: 0.30, row: 0),
                    SeatAnchor(xFraction: 0.70, row: 0),
                ],
                cardSize: CGSize(width: 60, height: 84),
                rowCount: 1
            )
        case 3:
            return Recipe(
                seats: [
                    SeatAnchor(xFraction: 0.20, row: 0),
                    SeatAnchor(xFraction: 0.50, row: 0),
                    SeatAnchor(xFraction: 0.80, row: 0),
                ],
                cardSize: CGSize(width: 56, height: 78),
                rowCount: 1
            )
        case 4:
            // Pad has width — keep a single readable row
            return Recipe(
                seats: [
                    SeatAnchor(xFraction: 0.14, row: 0),
                    SeatAnchor(xFraction: 0.38, row: 0),
                    SeatAnchor(xFraction: 0.62, row: 0),
                    SeatAnchor(xFraction: 0.86, row: 0),
                ],
                cardSize: CGSize(width: 52, height: 72),
                rowCount: 1
            )
        default:
            return Recipe(
                seats: [
                    SeatAnchor(xFraction: 0.18, row: 1),
                    SeatAnchor(xFraction: 0.50, row: 1),
                    SeatAnchor(xFraction: 0.82, row: 1),
                    SeatAnchor(xFraction: 0.32, row: -1),
                    SeatAnchor(xFraction: 0.68, row: -1),
                ],
                cardSize: CGSize(width: 52, height: 72),
                rowCount: 2
            )
        }
    }

    /// Vertical offset for a seat row given card height.
    static func rowY(row: Int, cardHeight: CGFloat) -> CGFloat {
        guard row != 0 else { return 0 }
        let gap = cardHeight * 1.15 + 14
        return CGFloat(row) * (gap / 2)
    }

    static func truncateName(_ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > nameMaxChars else { return trimmed }
        let end = trimmed.index(trimmed.startIndex, offsetBy: nameMaxChars - 1)
        return String(trimmed[..<end]) + "…"
    }
}

/// Bottom strip showing face-up hands of all remaining players when the human
/// is finished and spectating (solo / offline only).
final class SpectatorHandsNode: SKNode {
    private var appearance: AppearancePreset
    private var cardSize: CGSize
    private var viewportWidth: CGFloat = 390
    private var isWideDevice: Bool = false
    private var fanContainers: [PlayerId: SKNode] = [:]
    private var cardNodesByPlayer: [PlayerId: [CardNode]] = [:]
    private var lastRemainingCount: Int = 0
    private var lastRowCount: Int = 1

    /// 1 or 2 — GameScene uses this for vertical lift / table budget.
    private(set) var preferredRowCount: Int = 1

    init(appearance: AppearancePreset, cardSize: CGSize = CGSize(width: 52, height: 72)) {
        self.appearance = appearance
        self.cardSize = cardSize
        super.init()
        isHidden = true
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func setLayoutContext(viewportWidth: CGFloat, isWideDevice: Bool) {
        self.viewportWidth = max(120, viewportWidth)
        self.isWideDevice = isWideDevice
    }

    /// Backward-compatible width setter (keeps previous wide/compact flag).
    func setViewportWidth(_ width: CGFloat) {
        viewportWidth = max(120, width)
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
            lastRemainingCount = 0
            preferredRowCount = 1
            lastRowCount = 1
            return
        }

        // Stable order is caller-provided (game.players order via spectatorRemainingPlayerIds).
        let seated = Array(players.prefix(5))
        let recipe = SpectatorLayout.recipe(forRemaining: seated.count, isWide: isWideDevice)
        cardSize = recipe.cardSize
        preferredRowCount = recipe.rowCount

        let activeIds = Set(seated.map(\.id))
        for (pid, container) in fanContainers where !activeIds.contains(pid) {
            container.removeAllActions()
            container.removeFromParent()
            fanContainers.removeValue(forKey: pid)
            cardNodesByPlayer.removeValue(forKey: pid)
        }

        let countChanged = seated.count != lastRemainingCount
        let rowChanged = recipe.rowCount != lastRowCount
        lastRemainingCount = seated.count
        lastRowCount = recipe.rowCount
        let shouldAnimateSeats = countChanged || rowChanged

        // Precompute per-seat max half-width from row-mates only.
        let halfWidths = Self.halfWidths(for: recipe, viewportWidth: viewportWidth, cardWidth: cardSize.width)

        for (index, entry) in seated.enumerated() {
            let seat = recipe.seats[min(index, recipe.seats.count - 1)]
            let targetX = -viewportWidth / 2 + viewportWidth * seat.xFraction
            let targetY = SpectatorLayout.rowY(row: seat.row, cardHeight: cardSize.height)
            let target = CGPoint(x: targetX, y: targetY)
            let maxHalf = halfWidths[index]

            let container: SKNode
            if let existing = fanContainers[entry.id] {
                container = existing
            } else {
                container = SKNode()
                container.position = target
                addChild(container)
                fanContainers[entry.id] = container

                let nameLabel = SKLabelNode(text: SpectatorLayout.truncateName(entry.name))
                nameLabel.name = "nameLabel"
                nameLabel.fontName = "HelveticaNeue-Medium"
                nameLabel.fontSize = recipe.rowCount == 2 ? 9 : 10
                nameLabel.fontColor = UIColor(appearance.ui.accentMuted)
                nameLabel.horizontalAlignmentMode = .center
                nameLabel.verticalAlignmentMode = .bottom
                nameLabel.position = CGPoint(x: 0, y: cardSize.height * 0.55 + 4)
                container.addChild(nameLabel)
            }

            if let nameLabel = container.childNode(withName: "nameLabel") as? SKLabelNode {
                nameLabel.text = SpectatorLayout.truncateName(entry.name)
                nameLabel.fontColor = UIColor(appearance.ui.accent).withAlphaComponent(0.9)
                nameLabel.fontSize = recipe.rowCount == 2 ? 9 : 10
                nameLabel.position = CGPoint(x: 0, y: cardSize.height * 0.55 + 4)
            }

            moveContainer(container, to: target, animated: shouldAnimateSeats)

            layoutFan(
                for: entry.id,
                cards: entry.cards,
                in: container,
                maxHalfWidth: maxHalf,
                animated: true
            )
        }
    }

    /// Max fan half-width per seat, derived from horizontal distance to row-mates.
    private static func halfWidths(
        for recipe: SpectatorLayout.Recipe,
        viewportWidth: CGFloat,
        cardWidth: CGFloat
    ) -> [CGFloat] {
        let seats = recipe.seats
        var result: [CGFloat] = []
        result.reserveCapacity(seats.count)

        for (i, seat) in seats.enumerated() {
            var minDist = CGFloat.greatestFiniteMagnitude
            for (j, other) in seats.enumerated() where i != j && other.row == seat.row {
                let d = abs(other.xFraction - seat.xFraction) * viewportWidth
                minDist = min(minDist, d)
            }

            let fromNeighbor: CGFloat
            if minDist < CGFloat.greatestFiniteMagnitude / 2 {
                fromNeighbor = max(cardWidth * 0.55, (minDist - SpectatorLayout.minGutter) / 2)
            } else {
                // Solo on its row — generous envelope.
                fromNeighbor = viewportWidth * 0.28
            }
            result.append(fromNeighbor)
        }
        return result
    }

    private func moveContainer(_ container: SKNode, to point: CGPoint, animated: Bool) {
        let dx = abs(container.position.x - point.x)
        let dy = abs(container.position.y - point.y)
        guard dx > SpectatorLayout.containerMoveThreshold || dy > SpectatorLayout.containerMoveThreshold else {
            return
        }

        container.removeAction(forKey: "seatMove")
        let reduce = UIAccessibility.isReduceMotionEnabled
        if animated && !reduce {
            let move = SKAction.move(to: point, duration: SpectatorLayout.reflowDuration)
            move.timingMode = .easeInEaseOut
            container.run(move, withKey: "seatMove")
        } else {
            container.position = point
        }
    }

    private func layoutFan(
        for playerId: PlayerId,
        cards: [Card],
        in container: SKNode,
        maxHalfWidth: CGFloat,
        animated: Bool
    ) {
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
                if existing.cardSize != cardSize {
                    existing.updateSize(cardSize)
                }
                updated.append(existing)
            } else {
                let node = CardNode(card: card, isFaceUp: true, size: cardSize, appearance: appearance)
                container.addChild(node)
                updated.append(node)
            }
        }
        cardNodesByPlayer[playerId] = updated

        let n = updated.count
        guard n > 0 else {
            updateSeatChrome(in: container, cardCount: 0, twoTier: false)
            return
        }

        let maxFit = SpectatorLayout.maxFitAtPeek(maxHalfWidth: maxHalfWidth, cardWidth: cardSize.width)
        let useTwoTier = n > maxFit
        let frontCount = useTwoTier ? maxFit : n
        let backCount = useTwoTier ? n - frontCount : 0

        // Front = end of sorted hand (trump-right); back = overflow earlier cards.
        let backNodes = backCount > 0 ? Array(updated.prefix(backCount)) : []
        let frontNodes = Array(updated.suffix(frontCount))

        placeTier(
            back: backNodes,
            front: frontNodes,
            maxHalfWidth: maxHalfWidth,
            animated: animated
        )

        // Name + optional count chip for large hands.
        updateSeatChrome(in: container, cardCount: n, twoTier: useTwoTier)
    }

    private func placeTier(
        back: [CardNode],
        front: [CardNode],
        maxHalfWidth: CGFloat,
        animated: Bool
    ) {
        let usableSpan = max(0, 2 * maxHalfWidth - cardSize.width)
        let desiredSpacing = cardSize.width * 0.38
        let peek = SpectatorLayout.minPeekSpacing(cardWidth: cardSize.width)
        let reduce = UIAccessibility.isReduceMotionEnabled
        let backY = cardSize.height * 0.22

        func layout(_ nodes: [CardNode], yBase: CGFloat, zBase: CGFloat, preferPeekFloor: Bool) {
            let count = nodes.count
            guard count > 0 else { return }
            let mid = CGFloat(count - 1) / 2.0
            let available = count > 1 ? usableSpan / CGFloat(count - 1) : 0
            // Front keeps peek readability (maxFit guarantees available ≥ peek).
            // Back packs into the same span, allowing tighter overlap.
            let spacing: CGFloat
            if count <= 1 {
                spacing = 0
            } else if preferPeekFloor {
                spacing = min(desiredSpacing, max(peek, available))
            } else {
                spacing = min(desiredSpacing, available)
            }

            for (i, node) in nodes.enumerated() {
                let offset = CGFloat(i) - mid
                let targetPos = CGPoint(x: offset * spacing, y: yBase - abs(offset) * 1.0)
                let targetRot = offset * -0.018
                let z = zBase + CGFloat(i)

                let moved = hypot(node.position.x - targetPos.x, node.position.y - targetPos.y) > SpectatorLayout.cardMoveThreshold
                    || abs(node.zRotation - targetRot) > SpectatorLayout.rotationThreshold

                if animated && moved && !reduce {
                    node.flyTo(
                        position: targetPos,
                        rotation: targetRot,
                        zPosition: z,
                        duration: CardNode.FlightStyle.reflow.duration,
                        style: .reflow
                    )
                } else {
                    node.removeAction(forKey: "flyTo")
                    node.removeAction(forKey: "flyToCompletion")
                    node.position = targetPos
                    node.zRotation = targetRot
                    node.zPosition = z
                }
            }
        }

        // Back behind front.
        layout(back, yBase: backY, zBase: 0, preferPeekFloor: false)
        layout(front, yBase: 0, zBase: 100, preferPeekFloor: true)
    }

    private func updateSeatChrome(in container: SKNode, cardCount: Int, twoTier: Bool) {
        let nameY = cardSize.height * 0.55 + 4 + (twoTier ? cardSize.height * 0.22 : 0)
        if let nameLabel = container.childNode(withName: "nameLabel") as? SKLabelNode {
            nameLabel.position = CGPoint(x: 0, y: nameY)
        }

        let showCount = cardCount >= 8
        if showCount {
            let countLabel: SKLabelNode
            if let existing = container.childNode(withName: "countLabel") as? SKLabelNode {
                countLabel = existing
            } else {
                countLabel = SKLabelNode()
                countLabel.name = "countLabel"
                countLabel.fontName = "HelveticaNeue-Bold"
                countLabel.fontSize = 9
                countLabel.horizontalAlignmentMode = .center
                countLabel.verticalAlignmentMode = .top
                container.addChild(countLabel)
            }
            countLabel.text = "\(cardCount)"
            countLabel.fontColor = UIColor(appearance.ui.accent).withAlphaComponent(0.85)
            countLabel.position = CGPoint(x: 0, y: nameY - 12)
        } else if let existing = container.childNode(withName: "countLabel") {
            existing.removeFromParent()
        }
    }

    private func clearAll() {
        for container in fanContainers.values {
            container.removeAllActions()
            container.removeFromParent()
        }
        fanContainers.removeAll()
        cardNodesByPlayer.removeAll()
    }
}
