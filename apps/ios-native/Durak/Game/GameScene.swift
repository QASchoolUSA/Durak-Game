import SpriteKit
import DurakGameCore
import SwiftUI

/// The central SpriteKit scene rendering the felt card table, drag-and-drop card interaction,
/// animated card flights, opponent seats, and deck pile.
final class GameScene: SKScene {
    // MARK: - Nodes

    private let tableNode = TableNode(appearance: getAppearance(.green))
    private let handNode = HandNode(appearance: getAppearance(.green))
    private let spectatorHandsNode = SpectatorHandsNode(appearance: getAppearance(.green))
    private let deckNode = DeckPileNode(appearance: getAppearance(.green))
    private var opponentNodes: [String: OpponentFanNode] = [:]
    private let discardPileNode = SKNode()

    // MARK: - Drag State

    private var draggedCardNode: CardNode?
    private var dragTouchOffset: CGPoint = .zero
    private var dragStartScenePos: CGPoint = .zero
    private var lastDragPos: CGPoint = .zero
    private var lastDragTime: TimeInterval = 0
    private var currentDragVelocityX: CGFloat = 0
    private var hoveredDefenseSlotIndex: Int? = nil
    private var hoveredTransferSlot: Bool = false

    // MARK: - Round Transition Tracking

    private var previousTablePairs: [TablePair] = []
    private var previousDiscardCount: Int = 0
    private var previousDefenderId: String? = nil
    private var previousDeckCount: Int = 36
    private var isClearingRound: Bool = false
    /// When true, apply latest `vm.game` after the clear/take animation finishes.
    private var needsSyncAfterClear: Bool = false

    // MARK: - Dependencies & Callbacks

    weak var viewModel: GameViewModel?
    var appearance: AppearancePreset = getAppearance(.green) {
        didSet { applyAppearance() }
    }

    // MARK: - Lifecycle

    override func didMove(to view: SKView) {
        backgroundColor = .clear
        view.allowsTransparency = true
        scaleMode = .resizeFill

        addChild(tableNode)
        addChild(handNode)
        addChild(spectatorHandsNode)
        addChild(deckNode)
        addChild(discardPileNode)

        updateLayout()
    }

    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        updateLayout()
    }

    func applyAppearance() {
        backgroundColor = .clear
        if let vm = viewModel, let game = vm.game {
            syncState(game: game, vm: vm)
        }
    }

    private func updateLayout() {
        guard size.width > 0 && size.height > 0 else { return }

        // Table center — clear of top deck and bottom hand
        tableNode.position = CGPoint(x: size.width / 2, y: size.height * 0.44)
        tableNode.setTableSize(CGSize(width: size.width - 40, height: size.height * 0.36))

        // Human hand / spectator strip at bottom — anchored to bottom edge
        let handY = max(68, size.height * 0.085)
        handNode.position = CGPoint(x: size.width / 2, y: handY)
        handNode.setViewportWidth(size.width)
        handNode.layoutFan(animated: false)

        spectatorHandsNode.position = CGPoint(x: size.width / 2, y: handY + 8)
        spectatorHandsNode.setViewportWidth(size.width - 24)

        // Opponents around top arc — elevated higher with clean gap below status banner
        let topY = size.height * 0.845
        let sideY = size.height * 0.72
        layoutOpponents(topY: topY, sideY: sideY)

        // Deck pile: lower down closer to the cards area
        deckNode.position = CGPoint(x: size.width / 2, y: size.height * 0.61)

        // Discard pile off right edge
        discardPileNode.position = CGPoint(x: size.width + 60, y: size.height * 0.50)
    }

    private func layoutOpponents(topY: CGFloat? = nil, sideY: CGFloat? = nil) {
        let opponents = Array(opponentNodes.values)
        let count = opponents.count
        guard count > 0 else { return }

        let tY = topY ?? (size.height * 0.865)
        let sY = sideY ?? (size.height * 0.72)

        if count == 1 {
            opponents[0].position = CGPoint(x: size.width / 2, y: tY)
        } else if count == 2 {
            opponents[0].position = CGPoint(x: size.width * 0.28, y: tY)
            opponents[1].position = CGPoint(x: size.width * 0.72, y: tY)
        } else if count == 3 {
            opponents[0].position = CGPoint(x: 52, y: sY)
            opponents[1].position = CGPoint(x: size.width / 2, y: tY)
            opponents[2].position = CGPoint(x: size.width - 52, y: sY)
        } else {
            let spacing = (size.width - 80) / CGFloat(count - 1)
            for (i, opp) in opponents.enumerated() {
                let x = 40 + CGFloat(i) * spacing
                opp.position = CGPoint(x: x, y: tY)
            }
        }
    }

    /// Sorts cards in hand: grouped by suit, ascending by rank within each suit, with trump cards on the far right.
    private func sortHandCards(_ cards: [Card], trumpSuit: Suit) -> [Card] {
        let suitOrder: [Suit] = [.spades, .diamonds, .clubs, .hearts]
        let nonTrumpSuits = suitOrder.filter { $0 != trumpSuit }
        let orderedSuits = nonTrumpSuits + [trumpSuit]

        func suitIndex(_ suit: Suit) -> Int {
            orderedSuits.firstIndex(of: suit) ?? 99
        }

        return cards.sorted { a, b in
            let aIsTrump = (a.suit == trumpSuit)
            let bIsTrump = (b.suit == trumpSuit)
            if aIsTrump != bIsTrump {
                return !aIsTrump // Non-trump first, Trump on far right
            }
            if a.suit != b.suit {
                return suitIndex(a.suit) < suitIndex(b.suit)
            }
            return a.rank < b.rank // Smaller to highest within each suit
        }
    }

    // MARK: - State Sync from SwiftUI

    func syncState(game: GameState, vm: GameViewModel) {
        self.viewModel = vm

        // 1. Check if a bout just ended (clear or take)
        let wasTableOccupied = !previousTablePairs.isEmpty
        let isTableNowEmpty = game.table.isEmpty

        if wasTableOccupied && isTableNowEmpty && !isClearingRound {
            isClearingRound = true
            needsSyncAfterClear = false
            let discardGrew = game.discard.count > previousDiscardCount
            let prevDefender = previousDefenderId

            if discardGrew {
                // Round cleared: Биты!
                FeedbackManager.shared.trigger(.roundClear)
                let discardTarget = tableNode.convert(discardPileNode.position, from: self)
                tableNode.clearRound(toDiscardPosition: discardTarget) { [weak self] in
                    self?.finishRoundClearAnimation(vm: vm)
                }
            } else {
                // Defender took cards: Взял!
                FeedbackManager.shared.trigger(.takeCards)
                let takeTargetInScene: CGPoint
                if prevDefender == vm.humanId {
                    takeTargetInScene = handNode.position
                } else if let oppNode = opponentNodes[prevDefender ?? ""] {
                    takeTargetInScene = oppNode.position
                } else {
                    takeTargetInScene = CGPoint(x: size.width / 2, y: size.height * 0.8)
                }
                let takeTargetInTable = tableNode.convert(takeTargetInScene, from: self)
                tableNode.takeRound(toPosition: takeTargetInTable) { [weak self] in
                    self?.finishRoundClearAnimation(vm: vm)
                }
            }

            // Sync deck pile immediately
            deckNode.update(
                deckCount: game.deck.count,
                trumpCard: game.trumpCard,
                appearance: appearance
            )
            return
        }

        if isClearingRound {
            // Don't drop human/AI plays that land during the clear animation —
            // apply the latest state when the animation finishes.
            needsSyncAfterClear = true
            deckNode.update(
                deckCount: game.deck.count,
                trumpCard: game.trumpCard,
                appearance: appearance
            )
            return
        }

        previousTablePairs = game.table
        previousDiscardCount = game.discard.count
        previousDefenderId = game.defenderId

        // Audio check: Did we deal new cards from deck?
        if game.deck.count < previousDeckCount {
            FeedbackManager.shared.trigger(.deal)
        }
        previousDeckCount = game.deck.count

        syncCardsAndOpponents(game: game, vm: vm)
    }

    private func finishRoundClearAnimation(vm: GameViewModel) {
        isClearingRound = false
        // Always sync the *latest* game — not the empty snapshot captured at clear start.
        guard let latest = vm.game else {
            previousTablePairs = []
            needsSyncAfterClear = false
            return
        }
        previousTablePairs = latest.table
        previousDiscardCount = latest.discard.count
        previousDefenderId = latest.defenderId
        previousDeckCount = latest.deck.count
        needsSyncAfterClear = false
        syncCardsAndOpponents(game: latest, vm: vm)
    }

    private func syncCardsAndOpponents(game: GameState, vm: GameViewModel) {
        // 1. Deck pile
        deckNode.update(
            deckCount: game.deck.count,
            trumpCard: game.trumpCard,
            appearance: appearance
        )

        // 2. Table battle pairs (with Perevodnoy transfer slot indicator)
        let canTransferNow = game.rules.variant == .perevodnoy && DurakGameCore.canTransfer(game, vm.humanId)
        tableNode.updateTable(pairs: game.table, appearance: appearance, canTransfer: canTransferNow)

        // 3. Human hand — or solo spectator face-up strip of remaining players
        let isSoloSpectator = vm.isSpectator && vm.playMode == .solo
        if isSoloSpectator {
            handNode.isHidden = true
            handNode.updateHand(cards: [], playableCardIds: [], appearance: appearance)
            let remaining = vm.spectatorRemainingPlayerIds.map { pid in
                (
                    id: pid,
                    name: vm.names[pid] ?? "Player",
                    cards: sortHandCards(handOf(game, pid), trumpSuit: game.trumpSuit)
                )
            }
            spectatorHandsNode.update(players: remaining, appearance: appearance, visible: true)
        } else {
            spectatorHandsNode.update(players: [], appearance: appearance, visible: false)
            handNode.isHidden = false
            let rawCards = handOf(game, vm.humanId)
            let sortedCards = sortHandCards(rawCards, trumpSuit: game.trumpSuit)
            let playableIds = vm.playableCardIds()
            handNode.updateHand(cards: sortedCards, playableCardIds: playableIds, appearance: appearance)
        }

        // 4. Opponents
        let oppIds = game.players.filter { $0 != vm.humanId }
        let turnSeconds = TimeInterval(vm.turnTimerSeconds)
        for pid in oppIds {
            let pName = vm.names[pid] ?? "Opponent"
            let pHand = handOf(game, pid)
            let finished = game.finishedOrder.contains(pid)
            let isAttacker = game.attackerId == pid
            let isDefender = game.defenderId == pid
            let role: String? = isDefender ? "Defending" : (isAttacker ? "Attacking" : nil)
            let isTurn = !finished && (isAttacker || isDefender)
            let deadline: Date? = (vm.turnClockPlayerId == pid) ? vm.turnDeadlineAt : nil

            if let existing = opponentNodes[pid] {
                existing.update(
                    cardCount: pHand.count,
                    isCurrentTurn: isTurn,
                    role: role,
                    appearance: appearance,
                    finished: finished,
                    turnDeadlineAt: deadline,
                    turnTimerSeconds: turnSeconds
                )
            } else {
                let node = OpponentFanNode(playerId: pid, playerName: pName, appearance: appearance)
                node.update(
                    cardCount: pHand.count,
                    isCurrentTurn: isTurn,
                    role: role,
                    appearance: appearance,
                    finished: finished,
                    turnDeadlineAt: deadline,
                    turnTimerSeconds: turnSeconds
                )
                addChild(node)
                opponentNodes[pid] = node
            }
        }

        // Remove stale opponent nodes
        let currentOppSet = Set(oppIds)
        for (pid, node) in opponentNodes where !currentOppSet.contains(pid) {
            node.removeFromParent()
            opponentNodes.removeValue(forKey: pid)
        }

        layoutOpponents()
    }

    // MARK: - Touch Handling & Drag gestures

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, let vm = viewModel, let game = vm.game, game.phase == .playing else { return }
        // Spectators cannot play cards
        guard !vm.isHumanFinished else { return }

        let locationInScene = touch.location(in: self)
        let locationInHand = touch.location(in: handNode)

        if let cardNode = handNode.cardAt(point: locationInHand) {
            // Check if card is playable
            let playableIds = vm.playableCardIds()
            guard playableIds.contains(cardNode.card.id) else {
                FeedbackManager.shared.trigger(.failure)
                return
            }

            // Begin drag
            draggedCardNode = cardNode
            handNode.selectedCard = cardNode

            let posInScene = convert(cardNode.position, from: handNode)
            dragStartScenePos = posInScene
            dragTouchOffset = CGPoint(x: posInScene.x - locationInScene.x, y: posInScene.y - locationInScene.y)

            cardNode.removeFromParent()
            addChild(cardNode)
            cardNode.position = posInScene
            cardNode.zPosition = 1000
            cardNode.setLifted(true, animated: true)

            lastDragPos = posInScene
            lastDragTime = touch.timestamp
            currentDragVelocityX = 0
            hoveredDefenseSlotIndex = nil
            hoveredTransferSlot = false

            FeedbackManager.shared.trigger(.uiTap)
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, let cardNode = draggedCardNode, let vm = viewModel else { return }
        let locationInScene = touch.location(in: self)
        let targetPos = CGPoint(x: locationInScene.x + dragTouchOffset.x, y: locationInScene.y + dragTouchOffset.y)

        // Calculate velocity and 3D drag tilt inertia
        let dt = max(0.001, touch.timestamp - lastDragTime)
        let dx = targetPos.x - lastDragPos.x
        let instantaneousVx = dx / CGFloat(dt)

        // Smooth velocity with low-pass filter
        currentDragVelocityX = currentDragVelocityX * 0.75 + instantaneousVx * 0.25
        lastDragPos = targetPos
        lastDragTime = touch.timestamp

        // Dynamic tilt angle: physical paper card banking
        let maxTilt: CGFloat = 0.22 // ~12 degrees
        let targetTilt = -max(-maxTilt, min(maxTilt, currentDragVelocityX * 0.0003))

        // Check magnetic attraction to valid table slots
        var activeMagneticPos = targetPos
        var newHoverDefenseIndex: Int? = nil
        var newHoverTransfer = false

        if let game = vm.game {
            let card = cardNode.card
            if game.defenderId == vm.humanId {
                let canDoTransfer = DurakGameCore.canTransfer(game, vm.humanId)
                let legalTransfers = canDoTransfer ? DurakGameCore.legalTransfers(game, target: 0) : []
                let isTransferCard = legalTransfers.contains(where: { $0.id == card.id })

                if isTransferCard, let transferBounds = tableNode.transferSlotBounds {
                    let centerInScene = convert(CGPoint(x: transferBounds.midX, y: transferBounds.midY), from: tableNode)
                    let dist = hypot(targetPos.x - centerInScene.x, targetPos.y - centerInScene.y)
                    if dist < 55 {
                        let pullFactor: CGFloat = 0.35
                        activeMagneticPos = CGPoint(
                            x: targetPos.x + (centerInScene.x - targetPos.x) * pullFactor,
                            y: targetPos.y + (centerInScene.y - targetPos.y) * pullFactor
                        )
                        newHoverTransfer = true
                    }
                }

                if !newHoverTransfer {
                    let slots = tableNode.layoutSlots(pairCount: game.table.count)
                    for (i, pair) in game.table.enumerated() where pair.defense == nil {
                        if i < slots.count && DurakGameCore.beats(card, pair.attack, trumpSuit: game.trumpSuit) {
                            let slotCenterInScene = convert(slots[i].defensePosition, from: tableNode)
                            let dist = hypot(targetPos.x - slotCenterInScene.x, targetPos.y - slotCenterInScene.y)
                            if dist < 50 {
                                let pullFactor: CGFloat = 0.32
                                activeMagneticPos = CGPoint(
                                    x: targetPos.x + (slotCenterInScene.x - targetPos.x) * pullFactor,
                                    y: targetPos.y + (slotCenterInScene.y - targetPos.y) * pullFactor
                                )
                                newHoverDefenseIndex = i
                                break
                            }
                        }
                    }
                }
            }
        }

        // Trigger selection haptic if hover slot changed
        if newHoverDefenseIndex != hoveredDefenseSlotIndex || newHoverTransfer != hoveredTransferSlot {
            if newHoverDefenseIndex != nil || newHoverTransfer {
                FeedbackManager.shared.trigger(.selection)
            }
            hoveredDefenseSlotIndex = newHoverDefenseIndex
            hoveredTransferSlot = newHoverTransfer
            tableNode.highlightDefenseSlot(at: newHoverDefenseIndex)
            tableNode.highlightTransferSlot(newHoverTransfer)
        }

        cardNode.position = activeMagneticPos
        cardNode.zRotation = targetTilt
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let cardNode = draggedCardNode, let vm = viewModel, let game = vm.game else {
            cancelDrag()
            return
        }

        // Clear hover highlights
        tableNode.highlightDefenseSlot(at: nil)
        tableNode.highlightTransferSlot(false)
        hoveredDefenseSlotIndex = nil
        hoveredTransferSlot = false

        let dropScenePos = cardNode.position
        let dropTablePos = convert(dropScenePos, to: tableNode)
        let card = cardNode.card

        enum PendingPlay {
            case attack
            case defend(slot: Int)
            case transfer
        }

        var pending: PendingPlay? = nil

        // Determine destination:
        // 1. Is human defender?
        if game.defenderId == vm.humanId {
            let canDoTransfer = DurakGameCore.canTransfer(game, vm.humanId)
            let legalTransfers = canDoTransfer ? DurakGameCore.legalTransfers(game, target: 0) : []
            let isTransferCard = legalTransfers.contains(where: { $0.id == card.id })

            // Did the player drop onto the illuminated Transfer Slot?
            let droppedOnTransfer = tableNode.transferSlotBounds?.contains(dropTablePos) ?? false

            if droppedOnTransfer && isTransferCard {
                pending = .transfer
            } else {
                // Check defense against table slots
                let slots = tableNode.layoutSlots(pairCount: game.table.count)
                var targetSlot: Int? = nil
                for (i, pair) in game.table.enumerated() where pair.defense == nil {
                    if i < slots.count && slots[i].boundingBox.contains(dropTablePos) {
                        if DurakGameCore.beats(card, pair.attack, trumpSuit: game.trumpSuit) {
                            targetSlot = i
                            break
                        }
                    }
                }

                // If not dropped directly on a specific slot, choose first legal defense slot if over table
                if targetSlot == nil && abs(dropTablePos.y) < 180 {
                    for (i, pair) in game.table.enumerated() where pair.defense == nil {
                        if DurakGameCore.beats(card, pair.attack, trumpSuit: game.trumpSuit) {
                            targetSlot = i
                            break
                        }
                    }
                }

                if let slot = targetSlot {
                    pending = .defend(slot: slot)
                } else if isTransferCard && (abs(dropTablePos.y) < 180 && abs(dropTablePos.x) < size.width * 0.45) {
                    pending = .transfer
                }
            }
        } else {
            // Attacker or throw-in: dropped over table area
            let legalAttacks = DurakGameCore.legalAttacks(game, vm.humanId)
            let isLegal = legalAttacks.contains(where: { $0.id == card.id })
            if isLegal && (abs(dropTablePos.y) < 220 && abs(dropTablePos.x) < size.width * 0.45) {
                pending = .attack
            }
        }

        guard let play = pending else {
            FeedbackManager.shared.trigger(.failure)
            cancelDrag()
            return
        }

        FeedbackManager.shared.trigger(.cardPlay)
        handNode.detachCard(cardNode)
        draggedCardNode = nil

        switch play {
        case .attack:
            var resulting = game.table
            resulting.append(TablePair(attack: card))
            tableNode.adoptAttackFromHand(cardNode, resultingPairs: resulting)
            vm.submitHuman(.attack(player: vm.humanId, card: card))
        case .defend(let slot):
            var resulting = game.table
            if slot < resulting.count {
                resulting[slot].defense = card
            }
            tableNode.adoptDefenseFromHand(cardNode, slotIndex: slot, resultingPairs: resulting)
            vm.submitHuman(.defend(player: vm.humanId, card: card, target: slot))
        case .transfer:
            // Transfer adds a new attack pair; reuse attack handoff path visually
            var resulting = game.table
            resulting.append(TablePair(attack: card, viaTransfer: true))
            tableNode.adoptAttackFromHand(cardNode, resultingPairs: resulting)
            vm.submitHuman(.transfer(player: vm.humanId, card: card, target: 0))
        }

        if let updatedGame = vm.game {
            syncState(game: updatedGame, vm: vm)
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        cancelDrag()
    }

    private func cancelDrag() {
        guard let cardNode = draggedCardNode else { return }

        // Clear slot highlights
        tableNode.highlightDefenseSlot(at: nil)
        tableNode.highlightTransferSlot(false)
        hoveredDefenseSlotIndex = nil
        hoveredTransferSlot = false

        // Convert scene position into handNode's coordinate space before reparenting
        let posInHand = handNode.convert(cardNode.position, from: self)
        cardNode.removeFromParent()
        handNode.addChild(cardNode)
        cardNode.position = posInHand
        cardNode.setLifted(false, animated: true)
        handNode.returnCardToFan(cardNode)

        draggedCardNode = nil
        handNode.selectedCard = nil
    }
}
