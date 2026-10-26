import SpriteKit
import DurakGameCore
import SwiftUI

/// Node displaying the active battle pairs on the table (attacks and defenses).
final class TableNode: SKNode {
    struct SlotLayout {
        let index: Int
        let center: CGPoint
        let attackPosition: CGPoint
        let defensePosition: CGPoint
        let boundingBox: CGRect
    }

    private var pairNodes: [(attack: CardNode, defense: CardNode?)] = []
    private var slotIndicators: [SKShapeNode] = []
    /// Reusable defense-slot halos (avoids recreate + pulse restart every sync).
    private var haloPool: [SKShapeNode] = []
    private var transferNode: SKNode?
    private(set) var transferSlotBounds: CGRect?
    private var appearance: AppearancePreset
    private var cardSize: CGSize
    private var tableSize: CGSize = .zero

    private var reduceMotion: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    init(appearance: AppearancePreset, cardSize: CGSize = CGSize(width: 72, height: 100)) {
        self.appearance = appearance
        self.cardSize = cardSize
        super.init()
    }

    required init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func setTableSize(_ size: CGSize) {
        self.tableSize = size
    }

    func layoutSlots(pairCount: Int) -> [SlotLayout] {
        let columns = pairCount <= 1 ? 1 : (pairCount <= 3 ? pairCount : 3)
        let rows = max(1, Int(ceil(Double(max(pairCount, 1)) / Double(columns))))

        let pairWidth = cardSize.width + 12
        let pairHeight = cardSize.height + 14
        let spacingX: CGFloat = 16
        let spacingY: CGFloat = 16

        let totalWidth = CGFloat(columns) * pairWidth + CGFloat(columns - 1) * spacingX
        let totalHeight = CGFloat(rows) * pairHeight + CGFloat(rows - 1) * spacingY

        let startX = -totalWidth / 2 + pairWidth / 2
        let startY = totalHeight / 2 - pairHeight / 2

        var layouts: [SlotLayout] = []
        for i in 0..<max(pairCount, 1) {
            let row = i / columns
            let col = i % columns

            let centerX = startX + CGFloat(col) * (pairWidth + spacingX)
            let centerY = startY - CGFloat(row) * (pairHeight + spacingY)

            let attackPos = CGPoint(x: centerX - 8, y: centerY + 8)
            let defensePos = CGPoint(x: centerX + 8, y: centerY - 8)
            let bbox = CGRect(x: centerX - pairWidth / 2, y: centerY - pairHeight / 2, width: pairWidth, height: pairHeight)

            layouts.append(SlotLayout(index: i, center: CGPoint(x: centerX, y: centerY), attackPosition: attackPos, defensePosition: defensePos, boundingBox: bbox))
        }
        return layouts
    }

    func updateTable(pairs: [TablePair], appearance: AppearancePreset, canTransfer: Bool = false) {
        self.appearance = appearance

        // If pairs were cleared (e.g. after round clean up)
        if pairs.isEmpty {
            for pair in pairNodes {
                pair.attack.removeFromParent()
                pair.defense?.removeFromParent()
            }
            pairNodes.removeAll()

            for ind in slotIndicators {
                ind.removeFromParent()
            }
            slotIndicators.removeAll()

            hideTransferAffordance()
            return
        }

        let slots = layoutSlots(pairCount: pairs.count)
        var newPairNodes: [(attack: CardNode, defense: CardNode?)] = []

        // Park active indicators back into the pool (keep nodes alive).
        for ind in slotIndicators {
            ind.isHidden = true
            ind.removeAction(forKey: "haloPulse")
            if !haloPool.contains(where: { $0 === ind }) {
                haloPool.append(ind)
            }
        }
        slotIndicators.removeAll()

        for (i, pair) in pairs.enumerated() {
            guard i < slots.count else { break }
            let slot = slots[i]

            // Attack card: reuse existing (incl. in-flight human play) or animate in
            let attackNode: CardNode
            if let existingIndex = pairNodes.firstIndex(where: { $0.attack.card.id == pair.attack.id }) {
                attackNode = pairNodes[existingIndex].attack
                attackNode.updateAppearance(appearance)
                // Don't interrupt an in-flight fly from the hand
                if attackNode.action(forKey: "flyTo") == nil {
                    attackNode.flyTo(
                        position: slot.attackPosition,
                        duration: CardNode.FlightStyle.reflow.duration,
                        style: .reflow
                    )
                }
                attackNode.zPosition = CGFloat(10 + i * 2)
            } else {
                // New attack (typically AI/opponent) — spawn offset so travel is always visible.
                attackNode = CardNode(card: pair.attack, isFaceUp: true, size: cardSize, appearance: appearance)
                attackNode.position = CGPoint(x: slot.attackPosition.x, y: slot.attackPosition.y + 18)
                attackNode.zPosition = CGFloat(10 + i * 2)
                attackNode.zRotation = 0.04
                attackNode.setScale(0.90)
                addChild(attackNode)
                let delay = reduceMotion ? 0 : TimeInterval(i) * 0.03
                let flyDuration: TimeInterval = reduceMotion ? 0 : CardNode.FlightStyle.place.duration
                let attackTarget = slot.attackPosition
                let attackZ = CGFloat(10 + i * 2)
                attackNode.run(SKAction.sequence([
                    SKAction.wait(forDuration: delay),
                    SKAction.run { [weak attackNode] in
                        attackNode?.flyTo(
                            position: attackTarget,
                            rotation: 0,
                            zPosition: attackZ,
                            scale: 1.0,
                            duration: flyDuration,
                            style: .place,
                            onImpact: { FeedbackManager.shared.trigger(.cardPlay) }
                        )
                    }
                ]))
            }

            // Defense card if present
            var defNode: CardNode? = nil
            if let defenseCard = pair.defense {
                if let existingIndex = pairNodes.firstIndex(where: { $0.defense?.card.id == defenseCard.id }),
                   let existingDef = pairNodes[existingIndex].defense {
                    defNode = existingDef
                    existingDef.updateAppearance(appearance)
                    if existingDef.action(forKey: "flyTo") == nil {
                        existingDef.flyTo(
                            position: slot.defensePosition,
                            rotation: -0.08,
                            duration: CardNode.FlightStyle.place.duration,
                            style: .place
                        )
                    }
                    existingDef.zPosition = CGFloat(11 + i * 2)
                } else {
                    // New defense land (AI or sync) — staggered with attacks in the same sync.
                    let node = CardNode(card: defenseCard, isFaceUp: true, size: cardSize, appearance: appearance)
                    node.position = CGPoint(x: slot.defensePosition.x, y: slot.defensePosition.y + 14)
                    node.zPosition = CGFloat(11 + i * 2)
                    node.zRotation = -0.04
                    node.setScale(1.06)
                    addChild(node)
                    let delay = reduceMotion ? 0 : TimeInterval(i) * 0.03 + 0.02
                    let flyDuration: TimeInterval = reduceMotion ? 0 : CardNode.FlightStyle.place.duration
                    let defenseTarget = slot.defensePosition
                    let defenseZ = CGFloat(11 + i * 2)
                    node.run(SKAction.sequence([
                        SKAction.wait(forDuration: delay),
                        SKAction.run { [weak node] in
                            node?.flyTo(
                                position: defenseTarget,
                                rotation: -0.08,
                                zPosition: defenseZ,
                                scale: 1.0,
                                duration: flyDuration,
                                style: .place,
                                onImpact: { FeedbackManager.shared.trigger(.cardPlay) }
                            )
                        }
                    ]))
                    defNode = node
                }
            } else {
                // Undefended slot — reuse pooled halo (no recreate each sync).
                let halo = borrowHalo()
                halo.position = slot.defensePosition
                halo.zPosition = CGFloat(9 + i * 2)
                halo.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.45)
                halo.fillColor = UIColor(appearance.ui.accent).withAlphaComponent(0.08)
                halo.lineWidth = 1.5
                halo.alpha = 0.7
                halo.isHidden = false
                if halo.action(forKey: "haloPulse") == nil {
                    let pulse = SKAction.repeatForever(SKAction.sequence([
                        SKAction.fadeAlpha(to: 0.85, duration: 0.65),
                        SKAction.fadeAlpha(to: 0.35, duration: 0.65)
                    ]))
                    halo.run(pulse, withKey: "haloPulse")
                }
                slotIndicators.append(halo)
            }

            newPairNodes.append((attack: attackNode, defense: defNode))
        }

        // Remove any old nodes that are no longer part of pairs
        let currentAttackCards = Set(pairs.map { $0.attack })
        let currentDefenseCards = Set(pairs.compactMap { $0.defense })
        for oldPair in pairNodes {
            if !currentAttackCards.contains(oldPair.attack.card) {
                oldPair.attack.removeFromParent()
            }
            if let def = oldPair.defense, !currentDefenseCards.contains(def.card) {
                def.removeFromParent()
            }
        }
        self.pairNodes = newPairNodes

        // Perevodnoy transfer affordance: empty slot to the right of the full layout
        // (never overlapping attack cards). Always rebuild so reflow stays correct.
        if canTransfer, !slots.isEmpty {
            installTransferAffordance(slots: slots, appearance: appearance)
        } else {
            hideTransferAffordance()
        }
    }

    /// Clears transfer chrome immediately (e.g. when a transfer is committed).
    func hideTransferAffordance() {
        transferNode?.removeAllActions()
        transferNode?.removeFromParent()
        transferNode = nil
        transferSlotBounds = nil
    }

    /// Empty dashed slot placed clear of all pair columns, below card z-order.
    private func installTransferAffordance(slots: [SlotLayout], appearance: AppearancePreset) {
        hideTransferAffordance()

        let transferCenter = transferSlotCenter(for: slots)
        let container = SKNode()
        container.position = transferCenter
        // Below table cards (10+) so labels never paint over faces.
        container.zPosition = 7
        container.name = "transferAffordance"

        let rect = CGRect(
            x: -cardSize.width / 2,
            y: -cardSize.height / 2,
            width: cardSize.width,
            height: cardSize.height
        )
        let slotBg = SKShapeNode(rect: rect, cornerRadius: 10)
        slotBg.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.85)
        slotBg.fillColor = UIColor(appearance.ui.accent).withAlphaComponent(0.07)
        slotBg.lineWidth = 1.5
        container.addChild(slotBg)

        // Inner dashed path — empty drop target, not a card face.
        let inset = rect.insetBy(dx: 5, dy: 5)
        let dashPath = CGPath(
            roundedRect: inset,
            cornerWidth: 8,
            cornerHeight: 8,
            transform: nil
        ).copy(
            dashingWithPhase: 0,
            lengths: [5, 4]
        )
        let dashOutline = SKShapeNode(path: dashPath)
        dashOutline.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.55)
        dashOutline.fillColor = .clear
        dashOutline.lineWidth = 1.2
        container.addChild(dashOutline)

        // Caption sits above the slot so it cannot cover a landed card face.
        let captionY = cardSize.height / 2 + 14

        let icon = SKLabelNode(text: "⇄")
        icon.fontName = "HelveticaNeue-Bold"
        icon.fontSize = 16
        icon.fontColor = UIColor(appearance.ui.accent)
        icon.verticalAlignmentMode = .center
        icon.horizontalAlignmentMode = .center
        icon.position = CGPoint(x: 0, y: captionY + 10)
        container.addChild(icon)

        let label = SKLabelNode(text: String(localized: "TRANSFER"))
        label.fontName = "HelveticaNeue-Bold"
        label.fontSize = 9
        label.fontColor = UIColor(appearance.ui.accent)
        label.verticalAlignmentMode = .center
        label.horizontalAlignmentMode = .center
        label.position = CGPoint(x: 0, y: captionY - 4)
        container.addChild(label)

        let subLabel = SKLabelNode(text: String(localized: "Same Rank"))
        subLabel.fontName = "HelveticaNeue"
        subLabel.fontSize = 8
        subLabel.fontColor = UIColor(appearance.ui.accentMuted)
        subLabel.verticalAlignmentMode = .center
        subLabel.horizontalAlignmentMode = .center
        subLabel.position = CGPoint(x: 0, y: captionY - 16)
        container.addChild(subLabel)

        container.alpha = 1.0
        container.run(SKAction.repeatForever(SKAction.sequence([
            SKAction.fadeAlpha(to: 0.72, duration: 0.8),
            SKAction.fadeAlpha(to: 1.0, duration: 0.8)
        ])))

        addChild(container)
        transferNode = container
        transferSlotBounds = CGRect(
            x: transferCenter.x - cardSize.width / 2,
            y: transferCenter.y - cardSize.height / 2,
            width: cardSize.width,
            height: cardSize.height
        )
    }

    /// Center of the transfer drop zone: one column past the rightmost pair.
    private func transferSlotCenter(for slots: [SlotLayout]) -> CGPoint {
        let pairWidth = cardSize.width + 12
        let spacingX: CGFloat = 16
        guard let rightmost = slots.max(by: { $0.center.x < $1.center.x }) else {
            return .zero
        }
        return CGPoint(
            x: rightmost.center.x + pairWidth + spacingX,
            y: rightmost.center.y
        )
    }

    // MARK: - Human Play Handoff

    /// Reparents a dragged hand card onto the table as a new attack and flies it into slot.
    func adoptAttackFromHand(
        _ node: CardNode,
        resultingPairs: [TablePair],
        style: CardNode.FlightStyle = .place,
        onLand: (() -> Void)? = nil
    ) {
        let slots = layoutSlots(pairCount: max(resultingPairs.count, 1))
        let index = max(0, resultingPairs.count - 1)
        guard index < slots.count else {
            onLand?()
            return
        }

        reparentIntoTable(node)
        node.preserveVisualSize(thenResizeTo: cardSize)

        // Bookkeep before sync so updateTable reuses this node
        if pairNodes.count == index {
            pairNodes.append((attack: node, defense: nil))
        } else if index < pairNodes.count {
            pairNodes[index].attack.removeFromParent()
            pairNodes[index] = (attack: node, defense: pairNodes[index].defense)
        } else {
            pairNodes.append((attack: node, defense: nil))
        }

        let target = slots[index].attackPosition
        let duration: TimeInterval = reduceMotion ? 0 : style.duration
        node.zPosition = CGFloat(10 + index * 2)
        node.setLifted(false, animated: true, duration: duration)
        node.flyTo(
            position: target,
            rotation: 0,
            zPosition: node.zPosition,
            scale: 1.0,
            duration: duration,
            style: style,
            onImpact: onLand
        )
    }

    /// Reparents a dragged hand card onto the table as a defense on the given slot.
    func adoptDefenseFromHand(
        _ node: CardNode,
        slotIndex: Int,
        resultingPairs: [TablePair],
        style: CardNode.FlightStyle = .place,
        onLand: (() -> Void)? = nil
    ) {
        let slots = layoutSlots(pairCount: max(resultingPairs.count, 1))
        guard slotIndex < slots.count else {
            onLand?()
            return
        }

        reparentIntoTable(node)
        node.preserveVisualSize(thenResizeTo: cardSize)

        if slotIndex < pairNodes.count {
            pairNodes[slotIndex].defense?.removeFromParent()
            pairNodes[slotIndex] = (attack: pairNodes[slotIndex].attack, defense: node)
        }

        let target = slots[slotIndex].defensePosition
        let duration: TimeInterval = reduceMotion ? 0 : style.duration
        node.zPosition = CGFloat(11 + slotIndex * 2)
        node.setLifted(false, animated: true, duration: duration)
        node.flyTo(
            position: target,
            rotation: -0.08,
            zPosition: node.zPosition,
            scale: 1.0,
            duration: duration,
            style: style,
            onImpact: onLand
        )
    }

    private func reparentIntoTable(_ node: CardNode) {
        let posInTable: CGPoint
        if let parent = node.parent {
            posInTable = convert(node.position, from: parent)
        } else {
            posInTable = node.position
        }
        node.removeFromParent()
        addChild(node)
        node.position = posInTable
    }

    // MARK: - Slot Highlighting (Magnetic Guides)

    func highlightDefenseSlot(at index: Int?) {
        for (i, halo) in slotIndicators.enumerated() {
            // Avoid removeAllActions — keeps the soft pulse running.
            if let idx = index, i == idx {
                halo.strokeColor = UIColor(appearance.ui.accent)
                halo.fillColor = UIColor(appearance.ui.accent).withAlphaComponent(0.25)
                halo.lineWidth = 2.5
                halo.removeAction(forKey: "haloScale")
                halo.run(SKAction.scale(to: 1.08, duration: 0.12), withKey: "haloScale")
            } else {
                halo.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.4)
                halo.fillColor = UIColor(appearance.ui.accent).withAlphaComponent(0.08)
                halo.lineWidth = 1.5
                halo.removeAction(forKey: "haloScale")
                halo.run(SKAction.scale(to: 1.0, duration: 0.12), withKey: "haloScale")
            }
        }
    }

    private func borrowHalo() -> SKShapeNode {
        if let recycled = haloPool.popLast() {
            recycled.setScale(1.0)
            recycled.isHidden = false
            return recycled
        }
        let halo = SKShapeNode(
            rect: CGRect(x: -cardSize.width / 2, y: -cardSize.height / 2, width: cardSize.width, height: cardSize.height),
            cornerRadius: 8
        )
        addChild(halo)
        return halo
    }

    func highlightTransferSlot(_ active: Bool) {
        guard let transfer = transferNode else { return }
        transfer.removeAllActions()
        if active {
            transfer.run(SKAction.scale(to: 1.10, duration: 0.12))
            transfer.alpha = 1.0
        } else {
            transfer.run(SKAction.scale(to: 1.0, duration: 0.12))
            transfer.run(SKAction.repeatForever(SKAction.sequence([
                SKAction.fadeAlpha(to: 0.65, duration: 0.8),
                SKAction.fadeAlpha(to: 1.0, duration: 0.8)
            ])))
        }
    }

    // MARK: - Bout Transitions (Sweeps)

    func clearRound(toDiscardPosition pos: CGPoint, completion: @escaping () -> Void) {
        sweepPairs(to: pos, rotationRange: -0.3...0.3, duration: 0.32, stagger: 0.03, completion: completion)
    }

    func takeRound(toPosition pos: CGPoint, completion: @escaping () -> Void) {
        sweepPairs(to: pos, rotationRange: -0.15...0.15, duration: 0.28, stagger: 0.04, completion: completion)
    }

    /// Ordered table cards (attack then defense, left → right), reparented into `destination`
    /// with positions converted. Clears pair bookkeeping. Caller animates.
    @discardableResult
    func releaseCardsForTake(into destination: SKNode) -> [CardNode] {
        var ordered: [CardNode] = []
        for pair in pairNodes {
            ordered.append(pair.attack)
            if let defense = pair.defense {
                ordered.append(defense)
            }
        }

        for node in ordered {
            let posInDest = destination.convert(node.position, from: self)
            node.removeFromParent()
            destination.addChild(node)
            node.position = posInDest
        }

        pairNodes.removeAll()
        for ind in slotIndicators {
            ind.isHidden = true
            ind.removeAction(forKey: "haloPulse")
            if !haloPool.contains(where: { $0 === ind }) {
                haloPool.append(ind)
            }
        }
        slotIndicators.removeAll()
        hideTransferAffordance()
        return ordered
    }

    private func sweepPairs(
        to pos: CGPoint,
        rotationRange: ClosedRange<CGFloat>,
        duration: TimeInterval,
        stagger: TimeInterval,
        completion: @escaping () -> Void
    ) {
        guard !pairNodes.isEmpty else {
            completion()
            return
        }

        let motionDuration = reduceMotion ? 0 : duration
        let motionStagger = reduceMotion ? 0 : stagger

        if let transfer = transferNode {
            transfer.run(SKAction.fadeOut(withDuration: reduceMotion ? 0 : 0.18))
        }

        let group = DispatchGroup()
        for (i, pair) in pairNodes.enumerated() {
            let delay = Double(i) * motionStagger
            group.enter()
            let wait = SKAction.wait(forDuration: delay)
            let fly = SKAction.run {
                pair.attack.flyTo(
                    position: pos,
                    rotation: CGFloat.random(in: rotationRange),
                    scale: 0.85,
                    duration: motionDuration
                ) {
                    group.leave()
                }
            }
            pair.attack.run(SKAction.sequence([wait, fly]))

            if let def = pair.defense {
                group.enter()
                let defWait = SKAction.wait(forDuration: delay + (reduceMotion ? 0 : 0.02))
                let defFly = SKAction.run {
                    def.flyTo(
                        position: pos,
                        rotation: CGFloat.random(in: rotationRange),
                        scale: 0.85,
                        duration: motionDuration
                    ) {
                        group.leave()
                    }
                }
                def.run(SKAction.sequence([defWait, defFly]))
            }
        }

        for ind in slotIndicators {
            ind.run(SKAction.fadeOut(withDuration: reduceMotion ? 0 : 0.18))
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else {
                completion()
                return
            }
            self.pairNodes.forEach {
                $0.attack.removeFromParent()
                $0.defense?.removeFromParent()
            }
            self.pairNodes.removeAll()
            for ind in self.slotIndicators {
                ind.isHidden = true
                ind.removeAction(forKey: "haloPulse")
                if !self.haloPool.contains(where: { $0 === ind }) {
                    self.haloPool.append(ind)
                }
            }
            self.slotIndicators.removeAll()
            self.hideTransferAffordance()
            completion()
        }
    }
}
