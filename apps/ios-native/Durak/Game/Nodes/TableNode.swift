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
    private var transferNode: SKNode?
    private(set) var transferSlotBounds: CGRect?
    private var appearance: AppearancePreset
    private var cardSize: CGSize
    private var tableSize: CGSize = .zero

    private var reduceMotion: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    init(appearance: AppearancePreset, cardSize: CGSize = CGSize(width: 68, height: 95)) {
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

            let attackPos = CGPoint(x: centerX - 6, y: centerY + 6)
            let defensePos = CGPoint(x: centerX + 6, y: centerY - 6)
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

            transferNode?.removeFromParent()
            transferNode = nil
            transferSlotBounds = nil
            return
        }

        let slots = layoutSlots(pairCount: pairs.count)
        var newPairNodes: [(attack: CardNode, defense: CardNode?)] = []

        // Remove old slot indicators
        for ind in slotIndicators {
            ind.removeFromParent()
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
                    attackNode.flyTo(position: slot.attackPosition, duration: 0.22)
                }
                attackNode.zPosition = CGFloat(10 + i * 2)
            } else {
                attackNode = CardNode(card: pair.attack, isFaceUp: true, size: cardSize, appearance: appearance)
                attackNode.position = slot.attackPosition
                attackNode.zPosition = CGFloat(10 + i * 2)
                attackNode.setScale(0.85)
                addChild(attackNode)
                let popIn = SKAction.scale(to: 1.0, duration: reduceMotion ? 0 : 0.18)
                popIn.timingMode = .easeOut
                attackNode.run(popIn)
            }

            // Defense card if present
            var defNode: CardNode? = nil
            if let defenseCard = pair.defense {
                if let existingIndex = pairNodes.firstIndex(where: { $0.defense?.card.id == defenseCard.id }),
                   let existingDef = pairNodes[existingIndex].defense {
                    defNode = existingDef
                    existingDef.updateAppearance(appearance)
                    if existingDef.action(forKey: "flyTo") == nil {
                        existingDef.flyTo(position: slot.defensePosition, rotation: -0.05, duration: 0.22)
                    }
                    existingDef.zPosition = CGFloat(11 + i * 2)
                } else {
                    let node = CardNode(card: defenseCard, isFaceUp: true, size: cardSize, appearance: appearance)
                    node.position = CGPoint(x: slot.defensePosition.x, y: slot.defensePosition.y + 10)
                    node.zPosition = CGFloat(11 + i * 2)
                    node.zRotation = -0.05
                    node.setScale(1.08)
                    addChild(node)
                    let dropDown = SKAction.group([
                        SKAction.move(to: slot.defensePosition, duration: reduceMotion ? 0 : 0.18),
                        SKAction.scale(to: 1.0, duration: reduceMotion ? 0 : 0.18)
                    ])
                    dropDown.timingMode = .easeOut
                    node.run(dropDown)
                    defNode = node
                }
            } else {
                // Undefended attack slot outline/halo with pulsing animation
                let halo = SKShapeNode(rect: CGRect(x: -cardSize.width / 2, y: -cardSize.height / 2, width: cardSize.width, height: cardSize.height), cornerRadius: 8)
                halo.position = slot.defensePosition
                halo.zPosition = CGFloat(9 + i * 2)
                halo.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.45)
                halo.fillColor = UIColor(appearance.ui.accent).withAlphaComponent(0.08)
                halo.lineWidth = 1.5
                let pulse = SKAction.repeatForever(SKAction.sequence([
                    SKAction.fadeAlpha(to: 0.85, duration: 0.65),
                    SKAction.fadeAlpha(to: 0.35, duration: 0.65)
                ]))
                halo.run(pulse)
                addChild(halo)
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

        // Perevodnoy Transfer Slot: Illuminated slot next to the opening attack card
        if canTransfer, let openingSlot = slots.first {
            if transferNode == nil {
                let container = SKNode()
                let transferCenter = CGPoint(x: openingSlot.center.x + cardSize.width + 16, y: openingSlot.center.y)
                container.position = transferCenter
                container.zPosition = 15

                let rect = CGRect(x: -cardSize.width / 2, y: -cardSize.height / 2, width: cardSize.width, height: cardSize.height)
                let slotBg = SKShapeNode(rect: rect, cornerRadius: 10)
                slotBg.strokeColor = UIColor(appearance.ui.accent)
                slotBg.fillColor = UIColor(appearance.ui.accent).withAlphaComponent(0.09)
                slotBg.lineWidth = 1.5
                container.addChild(slotBg)

                let icon = SKLabelNode(text: "⇄")
                icon.fontName = "HelveticaNeue-Bold"
                icon.fontSize = 24
                icon.fontColor = UIColor(appearance.ui.accent)
                icon.verticalAlignmentMode = .center
                icon.horizontalAlignmentMode = .center
                icon.position = CGPoint(x: 0, y: 12)
                container.addChild(icon)

                let label = SKLabelNode(text: "TRANSFER")
                label.fontName = "HelveticaNeue-Bold"
                label.fontSize = 9
                label.fontColor = UIColor(appearance.ui.accent)
                label.verticalAlignmentMode = .center
                label.horizontalAlignmentMode = .center
                label.position = CGPoint(x: 0, y: -8)
                container.addChild(label)

                let subLabel = SKLabelNode(text: "Same Rank")
                subLabel.fontName = "HelveticaNeue"
                subLabel.fontSize = 8
                subLabel.fontColor = UIColor(DesignTokens.Colors.textMuted)
                subLabel.verticalAlignmentMode = .center
                subLabel.horizontalAlignmentMode = .center
                subLabel.position = CGPoint(x: 0, y: -20)
                container.addChild(subLabel)

                container.run(SKAction.repeatForever(SKAction.sequence([
                    SKAction.fadeAlpha(to: 0.65, duration: 0.8),
                    SKAction.fadeAlpha(to: 1.0, duration: 0.8)
                ])))

                addChild(container)
                self.transferNode = container

                let bbox = CGRect(x: transferCenter.x - cardSize.width / 2, y: transferCenter.y - cardSize.height / 2, width: cardSize.width, height: cardSize.height)
                self.transferSlotBounds = bbox
            }
        } else {
            transferNode?.removeFromParent()
            transferNode = nil
            transferSlotBounds = nil
        }
    }

    // MARK: - Human Play Handoff

    /// Reparents a dragged hand card onto the table as a new attack and flies it into slot.
    func adoptAttackFromHand(_ node: CardNode, resultingPairs: [TablePair]) {
        let slots = layoutSlots(pairCount: max(resultingPairs.count, 1))
        let index = max(0, resultingPairs.count - 1)
        guard index < slots.count else { return }

        reparentIntoTable(node)
        normalizeAdoptedCardSize(node)

        // Bookkeep before sync so updateTable reuses this node
        if pairNodes.count == index {
            pairNodes.append((attack: node, defense: nil))
        } else if index < pairNodes.count {
            pairNodes[index].attack.removeFromParent()
            pairNodes[index] = (attack: node, defense: pairNodes[index].defense)
        } else {
            while pairNodes.count < index {
                // Should not happen in normal play; pad defensively
                break
            }
            pairNodes.append((attack: node, defense: nil))
        }

        let target = slots[index].attackPosition
        let duration: TimeInterval = reduceMotion ? 0 : 0.22
        node.zPosition = CGFloat(10 + index * 2)
        node.setLifted(false, animated: false)
        node.flyTo(position: target, rotation: 0, zPosition: node.zPosition, scale: 1.0, duration: duration)
    }

    /// Reparents a dragged hand card onto the table as a defense on the given slot.
    func adoptDefenseFromHand(_ node: CardNode, slotIndex: Int, resultingPairs: [TablePair]) {
        let slots = layoutSlots(pairCount: max(resultingPairs.count, 1))
        guard slotIndex < slots.count else { return }

        reparentIntoTable(node)
        normalizeAdoptedCardSize(node)

        if slotIndex < pairNodes.count {
            pairNodes[slotIndex].defense?.removeFromParent()
            pairNodes[slotIndex] = (attack: pairNodes[slotIndex].attack, defense: node)
        }

        let target = slots[slotIndex].defensePosition
        let duration: TimeInterval = reduceMotion ? 0 : 0.22
        node.zPosition = CGFloat(11 + slotIndex * 2)
        node.setLifted(false, animated: false)
        node.flyTo(position: target, rotation: -0.05, zPosition: node.zPosition, scale: 1.0, duration: duration)
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

    private func normalizeAdoptedCardSize(_ node: CardNode) {
        // Hand cards are larger; resize to table card size while preserving visual scale during fly.
        let scaleFactor = cardSize.width / max(node.cardSize.width, 1)
        node.setScale(node.xScale * scaleFactor)
        node.updateSize(cardSize)
    }

    // MARK: - Slot Highlighting (Magnetic Guides)

    func highlightDefenseSlot(at index: Int?) {
        for (i, halo) in slotIndicators.enumerated() {
            halo.removeAllActions()
            if let idx = index, i == idx {
                halo.strokeColor = UIColor(appearance.ui.accent)
                halo.fillColor = UIColor(appearance.ui.accent).withAlphaComponent(0.25)
                halo.lineWidth = 2.5
                halo.run(SKAction.scale(to: 1.08, duration: 0.12))
            } else {
                halo.strokeColor = UIColor(appearance.ui.accent).withAlphaComponent(0.4)
                halo.fillColor = UIColor(appearance.ui.accent).withAlphaComponent(0.08)
                halo.lineWidth = 1.5
                halo.run(SKAction.scale(to: 1.0, duration: 0.12))
                let pulse = SKAction.repeatForever(SKAction.sequence([
                    SKAction.fadeAlpha(to: 0.8, duration: 0.6),
                    SKAction.fadeAlpha(to: 0.35, duration: 0.6)
                ]))
                halo.run(pulse)
            }
        }
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

        transferNode?.run(SKAction.fadeOut(withDuration: reduceMotion ? 0 : 0.18))

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
            self?.pairNodes.forEach {
                $0.attack.removeFromParent()
                $0.defense?.removeFromParent()
            }
            self?.pairNodes.removeAll()
            self?.slotIndicators.forEach { $0.removeFromParent() }
            self?.slotIndicators.removeAll()
            self?.transferNode?.removeFromParent()
            self?.transferNode = nil
            self?.transferSlotBounds = nil
            completion()
        }
    }
}
