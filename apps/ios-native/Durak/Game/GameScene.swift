import SpriteKit
import DurakGameCore
import SwiftUI

///The central SpriteKit scene rendering the felt card table, tap-or-drag card interaction,
/// animated card flights, opponent seats, and deck pile.
/// Adaptively scales and repositions table elements for iPhone (Portrait), iPadOS (Portrait & Landscape), and macOS Apple Silicon.
class GameScene: SKScene {
    // MARK: - Nodes

    let tableNode = TableNode(appearance: getAppearance(.green))
    let handNode = HandNode(appearance: getAppearance(.green))
    let spectatorHandsNode = SpectatorHandsNode(appearance: getAppearance(.green))
    let deckNode = DeckPileNode(appearance: getAppearance(.green))
    private(set) var opponentNodes: [String: OpponentFanNode] = [:]
    let discardPileNode = SKNode()

    /// Previous human hand ids — used to detect newly dealt cards for deck→hand flight.
    private var previousHumanHandIds: Set<String> = []
    /// Guards the opening shuffle + deal so reconnect/sync does not replay it.
    private var hasPlayedOpeningDeal: Bool = false
    /// Safe content insets (top/bottom safe area + SwiftUI top chrome).
    var contentInsets: UIEdgeInsets = .zero {
        didSet {
            guard contentInsets != oldValue else { return }
            updateLayout()
        }
    }

    /// Resets opening-deal bookkeeping for a new match.
    func resetOpeningDealState() {
        hasPlayedOpeningDeal = false
        previousHumanHandIds = []
    }

    // MARK: - Drag & Tap State

    private var draggedCardNode: CardNode?
    private var dragTouchOffset: CGPoint = .zero
    private var dragStartScenePos: CGPoint = .zero
    private var dragStartTime: TimeInterval = 0
    private var lastDragPos: CGPoint = .zero
    private var lastDragTime: TimeInterval = 0
    private var currentDragVelocityX: CGFloat = 0
    private var currentDragVelocityY: CGFloat = 0
    private var hoveredDefenseSlotIndex: Int? = nil
    private var hoveredTransferSlot: Bool = false
    private var hoveredAttackSlot: Bool = false

    /// Point-speed above which a release counts as a flick throw.
    private let flickSpeedThreshold: CGFloat = 780
    /// Minimum upward velocity component for a flick toward the table.
    private let flickUpwardMin: CGFloat = 140
    /// Maximum travel and duration for a quick tap-to-play gesture on a card in hand.
    private let tapMaxTravel: CGFloat = 24
    private let tapMaxDuration: TimeInterval = 0.35

    // MARK: - Round Transition Tracking

    private var previousTablePairs: [TablePair] = []
    private var previousDiscardCount: Int = 0
    private var previousDefenderId: String? = nil
    private var previousDeckCount: Int = 36
    private var isClearingRound: Bool = false
    /// When true, apply latest `vm.game` after the clear/take animation finishes.
    private var needsSyncAfterClear: Bool = false
    /// True while `dealCardsFromDeck` flights are in progress so concurrent AI syncs don't snap cards early.
    private var isDealtFlightActive: Bool = false
    private var pendingHandAfterDeal: (cards: [Card], playableIds: Set<String>)? = nil
    /// Card IDs that just flew table → hand on take; excluded from deck deal.
    private var lastTakenCardIds: Set<String> = []
    /// True while human take-to-hand flights are in progress.
    private var isTakeToHandActive: Bool = false
    /// Debounce magnet selection haptics (~100ms).
    private var lastMagnetHapticAt: TimeInterval = 0

    // MARK: - Dependencies & Callbacks

    weak var viewModel: GameViewModel?
    var appearance: AppearancePreset = getAppearance(.green) {
        didSet { applyAppearance() }
    }

    /// Current adaptive sprite scale (1.0 on iPhone, ~1.24–1.32 on iPad / Mac).
    private var currentSpriteScale: CGFloat {
        DesignTokens.Layout.spriteScale(for: size)
    }

    // MARK: - Lifecycle

    override func didMove(to view: SKView) {
        // Opaque felt — avoids compositing a clear SKView over SwiftUI every frame.
        backgroundColor = UIColor(appearance.table.backgroundColor)
        view.allowsTransparency = false
        view.ignoresSiblingOrder = true
        view.preferredFramesPerSecond = 60
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
        backgroundColor = UIColor(appearance.table.backgroundColor)
        if let vm = viewModel, let game = vm.game {
            syncState(game: game, vm: vm)
        }
    }

    func updateLayout() {
        guard size.width > 0 && size.height > 0 else { return }

        let top = contentInsets.top
        let bottom = contentInsets.bottom
        let usableHeight = max(120, size.height - top - bottom)
        let usableBottom = bottom
        let isLandscape = size.width > size.height
        let isWideDevice = min(size.width, size.height) >= 700
        let isCompactScreen = size.height < 720 && !isWideDevice
        let spriteScale = currentSpriteScale
        // Supersample cards (~2.5× on-screen pixels) so fan rotation / lift stay crisp.
        CardTextureCache.displayScale = spriteScale * 2.5

        // Scale major containers proportionally on iPad / Mac
        handNode.setScale(spriteScale)
        tableNode.setScale(spriteScale)
        deckNode.setScale(spriteScale)
        spectatorHandsNode.setScale(spriteScale)

        // Layout inside the inset-adjusted felt so chrome and dock buttons never cover cards.
        let handY: CGFloat
        if isWideDevice {
            handY = usableBottom + (isLandscape ? max(92, usableHeight * 0.145) : max(106, usableHeight * 0.125))
        } else {
            handY = usableBottom + (isCompactScreen ? max(78, usableHeight * 0.125) : max(82, usableHeight * 0.12))
        }

        // Playing area (battle table) and Deck coordinates:
        // Deck / trump / suit sit high toward opponent avatars so the horizontal trump
        // never kisses battle-table cards. Landscape keeps the cluster on the left flank.
        let seatYs = opponentSeatYs()
        let tableY: CGFloat
        let deckPos: CGPoint
        if isLandscape && isWideDevice {
            tableY = usableBottom + usableHeight * 0.54
            let deckX = max(120, size.width * 0.16)
            let raisedDeckY = tableY + max(56, usableHeight * 0.08)
            deckPos = CGPoint(x: deckX, y: min(raisedDeckY, seatYs.sideY - 40))
        } else {
            tableY = usableBottom + usableHeight * (isCompactScreen ? 0.545 : 0.515)
            let targetDeckY = usableBottom + usableHeight * (isCompactScreen ? 0.78 : 0.76)
            // Stay under side-seat avatars (~40pt clearance for trump/suit badges).
            let deckY = min(targetDeckY, seatYs.sideY - 40)
            deckPos = CGPoint(x: size.width / 2, y: deckY)
        }

        // Two-row spectator grids need a bit more vertical air under the battle table.
        let spectatorRows = spectatorHandsNode.isHidden ? 1 : spectatorHandsNode.preferredRowCount
        let tableHeightFactor: CGFloat = (spectatorRows == 2 && !spectatorHandsNode.isHidden) ? 0.30 : 0.34

        tableNode.position = CGPoint(x: size.width / 2, y: tableY)
        tableNode.setTableSize(CGSize(width: (size.width - 40) / spriteScale, height: (usableHeight * tableHeightFactor) / spriteScale))

        handNode.position = CGPoint(x: size.width / 2, y: handY)
        let maxHandWidth = isWideDevice ? min(size.width - 80, 760) : (size.width - 16)
        handNode.setViewportWidth(maxHandWidth / spriteScale)
        // Animate fan reflow on rotate/resize unless a deal/take flight is active.
        let animateFan = !isDealtFlightActive && !isTakeToHandActive && !isClearingRound
        handNode.layoutFan(animated: animateFan)

        // Lift spectator strip: higher when 2-row grid so top row clears table / bottom clears dock.
        let spectatorLift: CGFloat
        if spectatorRows == 2 {
            spectatorLift = isWideDevice ? 52 : 44
        } else {
            spectatorLift = isWideDevice ? 24 : 18
        }
        spectatorHandsNode.position = CGPoint(x: size.width / 2, y: handY + spectatorLift)
        spectatorHandsNode.setLayoutContext(
            viewportWidth: (size.width - 32) / spriteScale,
            isWideDevice: isWideDevice
        )

        applyOpponentSeatLayout()

        // Above table/opponents; below drag/deal temps (800+).
        deckNode.zPosition = 200
        deckNode.position = deckPos

        // Keep discard target on-screen (right edge of usable felt) for clear sweeps
        discardPileNode.position = CGPoint(x: size.width - 28, y: usableBottom + usableHeight * 0.56)
    }

    /// Seat Y band — below SwiftUI chrome (`contentInsets.top` already includes safe area + chrome).
    private func opponentSeatYs() -> (topY: CGFloat, sideY: CGFloat) {
        let top = contentInsets.top
        let bottom = contentInsets.bottom
        let usableHeight = max(120, size.height - top - bottom)
        let usableBottom = bottom
        let usableTop = size.height - top
        let isWideDevice = min(size.width, size.height) >= 700
        let seatAir: CGFloat = isWideDevice ? 14 : 4
        let topY = usableBottom + usableHeight * (isWideDevice ? 0.92 : 0.94)
        let sideY = usableBottom + usableHeight * (isWideDevice ? 0.82 : 0.84)
        return (min(topY, usableTop - seatAir), min(sideY, usableTop - seatAir - 24))
    }

    /// Fired after seats move so SwiftUI can place reaction bursts above avatars.
    var onSeatAnchorsChanged: (([String: CGPoint]) -> Void)?

    /// Screen-space point (UIKit, SpriteView coords) just above an opponent avatar.
    func reactionAnchor(for playerId: String) -> CGPoint? {
        guard let node = opponentNodes[playerId], let skView = view else { return nil }
        // Center on the avatar circle; name/role stay below (y ≈ -34) and stay readable.
        let localCenter = CGPoint(x: 0, y: 0)
        let scenePoint = node.convert(localCenter, to: self)
        return skView.convert(scenePoint, from: self)
    }

    func allOpponentReactionAnchors() -> [String: CGPoint] {
        var result: [String: CGPoint] = [:]
        for pid in opponentNodes.keys {
            if let pt = reactionAnchor(for: pid) {
                result[pid] = pt
            }
        }
        return result
    }

    private func publishSeatAnchors() {
        onSeatAnchorsChanged?(allOpponentReactionAnchors())
    }

    /// Stable seat placement shared by `updateLayout` and sync — never use fallback Y defaults.
    private func applyOpponentSeatLayout() {
        guard size.width > 0 && size.height > 0, !opponentNodes.isEmpty else {
            publishSeatAnchors()
            return
        }

        let humanId = viewModel?.humanId
        let orderedIds: [String]
        if let players = viewModel?.game?.players, let humanId {
            orderedIds = players.filter { $0 != humanId && opponentNodes[$0] != nil }
        } else {
            orderedIds = opponentNodes.keys.sorted()
        }
        // Append any stragglers not in players list (defensive).
        let extras = opponentNodes.keys.filter { !orderedIds.contains($0) }.sorted()
        let ids = orderedIds + extras
        let opponents = ids.compactMap { opponentNodes[$0] }
        let count = opponents.count
        guard count > 0 else { return }

        let ys = opponentSeatYs()
        let tY = ys.topY
        let sY = ys.sideY
        let spriteScale = currentSpriteScale
        let isWideDevice = min(size.width, size.height) >= 700
        let sideMargin: CGFloat = isWideDevice ? max(88, size.width * 0.12) : 52

        func pin(_ node: OpponentFanNode, to point: CGPoint) {
            node.setScale(spriteScale)
            let dx = abs(node.position.x - point.x)
            let dy = abs(node.position.y - point.y)
            guard dx > 0.5 || dy > 0.5 else { return }
            node.position = point
        }

        if count == 1 {
            pin(opponents[0], to: CGPoint(x: size.width / 2, y: tY))
        } else if count == 2 {
            pin(opponents[0], to: CGPoint(x: size.width * 0.30, y: tY))
            pin(opponents[1], to: CGPoint(x: size.width * 0.70, y: tY))
        } else if count == 3 {
            pin(opponents[0], to: CGPoint(x: sideMargin, y: sY))
            pin(opponents[1], to: CGPoint(x: size.width / 2, y: tY))
            pin(opponents[2], to: CGPoint(x: size.width - sideMargin, y: sY))
        } else {
            let edgePad: CGFloat = isWideDevice ? max(80, size.width * 0.10) : 40
            let spacing = (size.width - edgePad * 2) / CGFloat(count - 1)
            for (i, opp) in opponents.enumerated() {
                pin(opp, to: CGPoint(x: edgePad + CGFloat(i) * spacing, y: tY))
            }
        }

        publishSeatAnchors()
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
                if prevDefender == vm.humanId {
                    animateHumanTakeToHand(game: game, vm: vm) { [weak self] in
                        self?.finishRoundClearAnimation(vm: vm)
                    }
                } else {
                    let takeTargetInScene: CGPoint
                    if let oppNode = opponentNodes[prevDefender ?? ""] {
                        takeTargetInScene = oppNode.position
                    } else {
                        takeTargetInScene = CGPoint(x: size.width / 2, y: size.height * 0.8)
                    }
                    let takeTargetInTable = tableNode.convert(takeTargetInScene, from: self)
                    tableNode.takeRound(toPosition: takeTargetInTable) { [weak self] in
                        self?.finishRoundClearAnimation(vm: vm)
                    }
                }
            }

            // Failsafe: never leave the scene stuck if the clear animation never completes.
            removeAction(forKey: "clearRoundFailsafe")
            run(SKAction.sequence([
                SKAction.wait(forDuration: 1.5),
                SKAction.run { [weak self] in
                    guard let self, self.isClearingRound else { return }
                    self.finishRoundClearAnimation(vm: vm)
                }
            ]), withKey: "clearRoundFailsafe")

            // Sync deck pile immediately
            deckNode.update(
                deckCount: game.deck.count,
                trumpCard: game.trumpCard,
                trumpSuit: game.trumpSuit,
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
                trumpSuit: game.trumpSuit,
                appearance: appearance
            )
            return
        }

        previousTablePairs = game.table
        previousDiscardCount = game.discard.count
        previousDefenderId = game.defenderId

        previousDeckCount = game.deck.count
        syncCardsAndOpponents(game: game, vm: vm)
    }

    /// Continuous take: table cards fly into final fan slots (no deck teleport).
    private func animateHumanTakeToHand(game: GameState, vm: GameViewModel, completion: @escaping () -> Void) {
        let released = tableNode.releaseCardsForTake(into: self)
        guard !released.isEmpty else {
            completion()
            return
        }

        isTakeToHandActive = true
        let takenIds = Set(released.map(\.card.id))
        lastTakenCardIds = takenIds

        let sortedHand = sortHandCards(handOf(game, vm.humanId), trumpSuit: game.trumpSuit)
        let playableIds = vm.playableCardIds()
        let handCount = sortedHand.count
        let reduce = UIAccessibility.isReduceMotionEnabled
        let stagger: TimeInterval = reduce ? 0 : 0.04
        let flyDuration = reduce ? 0 : CardNode.FlightStyle.takeIn.duration
        let spriteScale = currentSpriteScale

        // Table was scaled; restore scene-space visual size after reparent.
        for node in released {
            node.setScale(spriteScale)
        }

        // Make room: existing cards slide toward final fan indices.
        handNode.reflowTowardFinalHand(sortedHand, playableCardIds: playableIds, animated: !reduce)

        let group = DispatchGroup()
        for (i, node) in released.enumerated() {
            group.enter()
            let slotIndex = sortedHand.firstIndex(where: { $0.id == node.card.id }) ?? i
            let target = handNode.sceneSlot(index: slotIndex, count: max(handCount, 1), in: self)
            node.zPosition = target.zPosition

            let delay = TimeInterval(i) * stagger
            node.run(SKAction.sequence([
                SKAction.wait(forDuration: delay),
                SKAction.run { [weak node, weak self] in
                    guard let node, let self else {
                        group.leave()
                        return
                    }
                    node.flyTo(
                        position: target.position,
                        rotation: target.rotation,
                        zPosition: target.zPosition,
                        scale: spriteScale,
                        duration: flyDuration,
                        style: .takeIn,
                        completion: {
                            self.handNode.adoptFlyingCard(
                                node,
                                playable: playableIds.contains(node.card.id),
                                atSlot: slotIndex,
                                handCount: max(handCount, 1)
                            )
                            group.leave()
                        }
                    )
                }
            ]))
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else {
                completion()
                return
            }
            self.isTakeToHandActive = false
            // Merge final order / playable without recreating adopted nodes.
            self.handNode.updateHand(cards: sortedHand, playableCardIds: playableIds, appearance: self.appearance)
            self.previousHumanHandIds.formUnion(takenIds)
            completion()
        }
    }

    /// Flies cards from the deck pile into the human hand (deal / draw-up).
    /// - Parameter useShuffleSound: opening deal plays `.shuffle`; mid-bout draws use `.deal`.
    func dealCardsFromDeck(
        _ cards: [Card],
        intoHandSorted sortedHand: [Card],
        playableIds: Set<String>,
        useShuffleSound: Bool = false,
        completion: (() -> Void)? = nil
    ) {
        guard !cards.isEmpty else {
            completion?()
            return
        }

        isDealtFlightActive = true
        pendingHandAfterDeal = (cards: sortedHand, playableIds: playableIds)

        // Opening: one full shuffle cue. Mid-bout: per-card draw ticks timed to each flight.
        if useShuffleSound {
            FeedbackManager.shared.trigger(.shuffle)
        }
        let reduce = UIAccessibility.isReduceMotionEnabled
        let group = DispatchGroup()
        let stagger: TimeInterval = useShuffleSound ? 0.045 : 0.050
        let flyDuration: TimeInterval = useShuffleSound ? 0.26 : 0.22
        let spriteScale = currentSpriteScale
        let handCount = sortedHand.count

        // Warm canonical backs + first-hand fronts once (bounded bake; no size-bucket churn).
        CardTextureCache.prefetch(cards: cards, appearance: appearance)

        for (i, card) in cards.enumerated() {
            group.enter()
            let node = CardNode(card: card, isFaceUp: false, size: CardTextureCache.canonicalSize, appearance: appearance)
            node.position = deckNode.position
            node.zPosition = 800 + CGFloat(i)
            node.setScale(0.55 * spriteScale)
            addChild(node)

            let delay = reduce ? 0 : TimeInterval(i) * stagger
            let duration: TimeInterval = reduce ? 0 : flyDuration
            let slotIndex = sortedHand.firstIndex(where: { $0.id == card.id }) ?? i
            let target = handNode.sceneSlot(index: slotIndex, count: max(handCount, 1), in: self)

            node.run(SKAction.sequence([
                SKAction.wait(forDuration: delay),
                SKAction.run { [weak node] in
                    if !useShuffleSound {
                        FeedbackManager.shared.trigger(.deal)
                    }
                    node?.flip(toFaceUp: true, duration: reduce ? 0 : 0.14)
                },
                SKAction.run { [weak node, weak self] in
                    guard let node, let self else {
                        group.leave()
                        return
                    }
                    node.flyTo(
                        position: target.position,
                        rotation: target.rotation,
                        zPosition: target.zPosition,
                        scale: spriteScale,
                        duration: duration,
                        style: .place,
                        completion: {
                            self.handNode.adoptFlyingCard(
                                node,
                                playable: playableIds.contains(card.id),
                                atSlot: slotIndex,
                                handCount: max(handCount, 1)
                            )
                            group.leave()
                        }
                    )
                }
            ]))
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else {
                completion?()
                return
            }
            self.isDealtFlightActive = false
            let finalHand = self.pendingHandAfterDeal ?? (cards: sortedHand, playableIds: playableIds)
            self.pendingHandAfterDeal = nil
            self.handNode.updateHand(cards: finalHand.cards, playableCardIds: finalHand.playableIds, appearance: self.appearance)
            completion?()
        }
    }

    private func finishRoundClearAnimation(vm: GameViewModel) {
        removeAction(forKey: "clearRoundFailsafe")
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
        // 1. Deck pile (always pass trumpSuit so empty deck still shows trump emblem)
        deckNode.update(
            deckCount: game.deck.count,
            trumpCard: game.trumpCard,
            trumpSuit: game.trumpSuit,
            appearance: appearance
        )

        // 2. Table battle pairs (with Perevodnoy transfer slot indicator)
        let canTransferNow = game.rules.variant == .perevodnoy && DurakGameCore.canTransfer(game, vm.humanId)
        tableNode.updateTable(pairs: game.table, appearance: appearance, canTransfer: canTransferNow)

        // 3. Human hand — or solo spectator face-up strip of remaining players
        let isSoloSpectator = vm.isSpectator && vm.playMode == .solo
        let wasSpectatorVisible = !spectatorHandsNode.isHidden
        let previousSpectatorRows = spectatorHandsNode.preferredRowCount
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
            // Ensure wide/compact context is current before recipe selection.
            let isWideDevice = min(size.width, size.height) >= 700
            spectatorHandsNode.setLayoutContext(
                viewportWidth: (size.width - 32) / currentSpriteScale,
                isWideDevice: isWideDevice
            )
            spectatorHandsNode.update(players: remaining, appearance: appearance, visible: true)
        } else {
            spectatorHandsNode.update(players: [], appearance: appearance, visible: false)
            handNode.isHidden = false
            let rawCards = handOf(game, vm.humanId)
            let sortedCards = sortHandCards(rawCards, trumpSuit: game.trumpSuit)
            let playableIds = vm.playableCardIds()
            let priorIds = previousHumanHandIds
            let newIds = Set(sortedCards.map(\.id))
            let dealtIds = newIds.subtracting(priorIds)
            // Taken cards already flew table→hand; only true deck draws use deal flight.
            let takenIds = lastTakenCardIds
            if !takenIds.isEmpty {
                lastTakenCardIds = []
            }
            let deckDealtIds = dealtIds.subtracting(takenIds)
            previousHumanHandIds = newIds

            let deckDealtCards = sortedCards.filter { deckDealtIds.contains($0.id) }
            let allDealtCards = sortedCards.filter { dealtIds.contains($0.id) }
            // Fresh match: empty prior, or rematch on a reused scene (disjoint hands, empty table/discard).
            let isFreshMatch =
                priorIds.isEmpty
                || (priorIds.isDisjoint(with: newIds)
                    && game.table.isEmpty
                    && game.discard.isEmpty
                    && game.finishedOrder.isEmpty)
            let isOpeningDeal =
                !allDealtCards.isEmpty
                && allDealtCards.count == sortedCards.count
                && isFreshMatch
                && (!hasPlayedOpeningDeal || !priorIds.isEmpty)

            if isOpeningDeal && !isClearingRound {
                hasPlayedOpeningDeal = true
                handNode.updateHand(cards: [], playableCardIds: [], appearance: appearance)
                dealCardsFromDeck(
                    allDealtCards,
                    intoHandSorted: sortedCards,
                    playableIds: playableIds,
                    useShuffleSound: true
                )
            } else if !deckDealtCards.isEmpty && !priorIds.isEmpty && !isClearingRound && !isTakeToHandActive {
                // Mid-bout draw-up: short deal cue + flight (taken cards already in hand).
                let remainingWithoutDeckDealt = sortedCards.filter { !deckDealtIds.contains($0.id) }
                handNode.updateHand(cards: remainingWithoutDeckDealt, playableCardIds: playableIds, appearance: appearance)
                dealCardsFromDeck(deckDealtCards, intoHandSorted: sortedCards, playableIds: playableIds)
            } else if !isDealtFlightActive && !isTakeToHandActive {
                if !sortedCards.isEmpty {
                    hasPlayedOpeningDeal = true
                }
                handNode.updateHand(cards: sortedCards, playableCardIds: playableIds, appearance: appearance)
            } else {
                // A deal / take flight is currently in progress; keep latest hand for completion.
                pendingHandAfterDeal = (cards: sortedCards, playableIds: playableIds)
            }
        }

        // Re-budget vertical layout when spectator strip appears/hides or switches 1↔2 rows.
        let spectatorVisible = !spectatorHandsNode.isHidden
        if spectatorVisible != wasSpectatorVisible
            || spectatorHandsNode.preferredRowCount != previousSpectatorRows {
            updateLayout()
        }

        // 4. Opponents
        let oppIds = game.players.filter { $0 != vm.humanId }
        let turnSeconds = TimeInterval(vm.turnTimerSeconds)
        for pid in oppIds {
            let pName = vm.names[pid] ?? String(localized: "Opponent")
            let pHand = handOf(game, pid)
            let finished = game.finishedOrder.contains(pid)
            let isAttacker = game.attackerId == pid
            let isDefender = game.defenderId == pid
            let role: String? = isDefender
                ? String(localized: "Defending")
                : (isAttacker ? String(localized: "Attacking") : nil)
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

        applyOpponentSeatLayout()
    }

    // MARK: - Touch Handling: Instant Tap-to-Play + Magnetic Drag-to-Play

    private enum PendingPlay {
        case attack
        case defend(slot: Int)
        case transfer
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, let vm = viewModel, let game = vm.game, game.phase == .playing else { return }
        // Spectators cannot play cards
        guard !vm.isHumanFinished else { return }
        // Block drag/tap before animation while an online move is confirming.
        guard !vm.isSubmittingOnlineMove else {
            FeedbackManager.shared.trigger(.failure)
            return
        }

        let locationInScene = touch.location(in: self)
        let locationInHand = touch.location(in: handNode)

        if let cardNode = handNode.cardAt(point: locationInHand) {
            // Check if card is playable
            let playableIds = vm.playableCardIds()
            guard playableIds.contains(cardNode.card.id) else {
                FeedbackManager.shared.trigger(.failure)
                return
            }

            // Begin drag / tap tracking immediately on touch-down
            draggedCardNode = cardNode
            handNode.selectedCard = cardNode

            let posInScene = convert(cardNode.position, from: handNode)
            dragStartScenePos = posInScene
            dragStartTime = touch.timestamp
            dragTouchOffset = CGPoint(x: posInScene.x - locationInScene.x, y: posInScene.y - locationInScene.y)

            cardNode.removeFromParent()
            addChild(cardNode)
            cardNode.position = posInScene
            cardNode.zPosition = 1000
            cardNode.setScale(currentSpriteScale)
            cardNode.setLifted(true, animated: true)

            lastDragPos = posInScene
            lastDragTime = touch.timestamp
            currentDragVelocityX = 0
            currentDragVelocityY = 0
            hoveredDefenseSlotIndex = nil
            hoveredTransferSlot = false
            hoveredAttackSlot = false

            FeedbackManager.shared.trigger(.uiTap)
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, let cardNode = draggedCardNode, let vm = viewModel else { return }
        let locationInScene = touch.location(in: self)
        let targetPos = CGPoint(x: locationInScene.x + dragTouchOffset.x, y: locationInScene.y + dragTouchOffset.y)

        let dt = max(0.001, touch.timestamp - lastDragTime)
        let dx = targetPos.x - lastDragPos.x
        let dy = targetPos.y - lastDragPos.y
        let instantaneousVx = dx / CGFloat(dt)
        let instantaneousVy = dy / CGFloat(dt)

        currentDragVelocityX = currentDragVelocityX * 0.72 + instantaneousVx * 0.28
        currentDragVelocityY = currentDragVelocityY * 0.72 + instantaneousVy * 0.28
        lastDragPos = targetPos
        lastDragTime = touch.timestamp

        // Dynamic tilt with smoothing (paper banking)
        let maxTilt: CGFloat = 0.20
        let targetTilt = -max(-maxTilt, min(maxTilt, currentDragVelocityX * 0.00028))
        let smoothedTilt = cardNode.zRotation + (targetTilt - cardNode.zRotation) * 0.32

        var activeMagneticPos = targetPos
        var newHoverDefenseIndex: Int? = nil
        var newHoverTransfer = false
        var newHoverAttack = false
        let reduce = UIAccessibility.isReduceMotionEnabled
        let magnetRadius = 60 * currentSpriteScale

        if let game = vm.game, !reduce {
            let card = cardNode.card
            if game.defenderId == vm.humanId {
                let canDoTransfer = DurakGameCore.canTransfer(game, vm.humanId)
                let legalTransfers = canDoTransfer ? DurakGameCore.legalTransfers(game, target: 0) : []
                let isTransferCard = legalTransfers.contains(where: { $0.id == card.id })

                if isTransferCard, let transferBounds = tableNode.transferSlotBounds {
                    let centerInScene = convert(CGPoint(x: transferBounds.midX, y: transferBounds.midY), from: tableNode)
                    let dist = hypot(targetPos.x - centerInScene.x, targetPos.y - centerInScene.y)
                    if dist < magnetRadius {
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
                            if dist < magnetRadius {
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
            } else {
                // Attack / throw-in magnetism toward next table slot
                let legalAttacks = DurakGameCore.legalAttacks(game, vm.humanId)
                if legalAttacks.contains(where: { $0.id == card.id }) {
                    let nextCount = game.table.count + 1
                    let slots = tableNode.layoutSlots(pairCount: max(nextCount, 1))
                    let index = max(0, nextCount - 1)
                    if index < slots.count {
                        let slotCenterInScene = convert(slots[index].attackPosition, from: tableNode)
                        let dist = hypot(targetPos.x - slotCenterInScene.x, targetPos.y - slotCenterInScene.y)
                        if dist < magnetRadius {
                            let pullFactor: CGFloat = 0.28
                            activeMagneticPos = CGPoint(
                                x: targetPos.x + (slotCenterInScene.x - targetPos.x) * pullFactor,
                                y: targetPos.y + (slotCenterInScene.y - targetPos.y) * pullFactor
                            )
                            newHoverAttack = true
                        }
                    }
                }
            }
        }

        let magnetChanged =
            newHoverDefenseIndex != hoveredDefenseSlotIndex
            || newHoverTransfer != hoveredTransferSlot
            || newHoverAttack != hoveredAttackSlot
        if magnetChanged {
            if newHoverDefenseIndex != nil || newHoverTransfer || newHoverAttack {
                let now = CACurrentMediaTime()
                if now - lastMagnetHapticAt >= 0.10 {
                    lastMagnetHapticAt = now
                    FeedbackManager.shared.trigger(.selection)
                }
            }
            hoveredDefenseSlotIndex = newHoverDefenseIndex
            hoveredTransferSlot = newHoverTransfer
            hoveredAttackSlot = newHoverAttack
            tableNode.highlightDefenseSlot(at: newHoverDefenseIndex)
            tableNode.highlightTransferSlot(newHoverTransfer)
        }

        cardNode.position = activeMagneticPos
        cardNode.zRotation = reduce ? 0 : smoothedTilt
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let cardNode = draggedCardNode, let vm = viewModel, let game = vm.game else {
            cancelDrag()
            return
        }

        let touchTimestamp = touches.first?.timestamp ?? lastDragTime
        let touchDuration = max(0, touchTimestamp - dragStartTime)

        tableNode.highlightDefenseSlot(at: nil)
        tableNode.highlightTransferSlot(false)
        hoveredDefenseSlotIndex = nil
        hoveredTransferSlot = false
        hoveredAttackSlot = false

        let dropScenePos = cardNode.position
        let dropTablePos = convert(dropScenePos, to: tableNode)
        let card = cardNode.card
        let travelFromStart = hypot(dropScenePos.x - dragStartScenePos.x, dropScenePos.y - dragStartScenePos.y)
        let upwardDelta = dropScenePos.y - dragStartScenePos.y
        let speed = hypot(currentDragVelocityX, currentDragVelocityY)

        // A quick tap on a playable card in hand OR a decisive upward swipe/flick plays it immediately!
        let isQuickTap = travelFromStart <= tapMaxTravel && touchDuration <= tapMaxDuration
        let isUpwardCommit = upwardDelta >= 44
        let isFlick = (speed >= flickSpeedThreshold && currentDragVelocityY >= flickUpwardMin) || isQuickTap

        let pending = resolvePendingPlay(
            game: game,
            vm: vm,
            card: card,
            dropTablePos: dropTablePos,
            isFlick: isFlick || isUpwardCommit
        )

        guard let play = pending else {
            cancelDrag(playFailureHaptic: !isQuickTap)
            return
        }

        // Re-check after drag — a concurrent sync may have started a submit.
        guard !vm.isSubmittingOnlineMove else {
            cancelDrag(playFailureHaptic: true)
            return
        }

        let style: CardNode.FlightStyle = isFlick ? .flick : .place
        handNode.detachCard(cardNode)
        draggedCardNode = nil

        let onLand = {
            FeedbackManager.shared.trigger(.cardPlay)
        }

        switch play {
        case .attack:
            var resulting = game.table
            resulting.append(TablePair(attack: card))
            tableNode.adoptAttackFromHand(cardNode, resultingPairs: resulting, style: style, onLand: onLand)
            vm.submitHuman(.attack(player: vm.humanId, card: card))
        case .defend(let slot):
            var resulting = game.table
            if slot < resulting.count {
                resulting[slot].defense = card
            }
            tableNode.adoptDefenseFromHand(cardNode, slotIndex: slot, resultingPairs: resulting, style: style, onLand: onLand)
            vm.submitHuman(.defend(player: vm.humanId, card: card, target: slot))
        case .transfer:
            // Hide chrome before the card lands so TRANSFER labels never paint over the face.
            tableNode.hideTransferAffordance()
            var resulting = game.table
            resulting.append(TablePair(attack: card, viaTransfer: true))
            tableNode.adoptAttackFromHand(cardNode, resultingPairs: resulting, style: style, onLand: onLand)
            vm.submitHuman(.transfer(player: vm.humanId, card: card, target: 0))
        }

        if let updatedGame = vm.game {
            syncState(game: updatedGame, vm: vm)
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        cancelDrag()
    }

    private func resolvePendingPlay(
        game: GameState,
        vm: GameViewModel,
        card: Card,
        dropTablePos: CGPoint,
        isFlick: Bool
    ) -> PendingPlay? {
        let overTableLoose = abs(dropTablePos.y) < 220 && abs(dropTablePos.x) < size.width * 0.48

        if game.defenderId == vm.humanId {
            let canDoTransfer = DurakGameCore.canTransfer(game, vm.humanId)
            let legalTransfers = canDoTransfer ? DurakGameCore.legalTransfers(game, target: 0) : []
            let isTransferCard = legalTransfers.contains(where: { $0.id == card.id })
            let droppedOnTransfer = tableNode.transferSlotBounds?.contains(dropTablePos) ?? false

            if droppedOnTransfer && isTransferCard {
                return .transfer
            }

            let canBeatAnyUndefended = game.table.contains { pair in
                pair.defense == nil && DurakGameCore.beats(card, pair.attack, trumpSuit: game.trumpSuit)
            }

            // Same-rank transfer cards that cannot beat anything should transfer on
            // loose/flick commits — not get stuck looking for a defense slot.
            if isTransferCard && !canBeatAnyUndefended && (overTableLoose || isFlick) {
                return .transfer
            }

            let slots = tableNode.layoutSlots(pairCount: game.table.count)
            var targetSlot: Int? = nil

            // Prefer hovered / nearest legal defense slot
            for (i, pair) in game.table.enumerated() where pair.defense == nil {
                guard i < slots.count, DurakGameCore.beats(card, pair.attack, trumpSuit: game.trumpSuit) else { continue }
                if slots[i].boundingBox.contains(dropTablePos) {
                    targetSlot = i
                    break
                }
            }

            if targetSlot == nil && (overTableLoose || isFlick) {
                // Nearest legal undefended slot
                var bestDist = CGFloat.greatestFiniteMagnitude
                for (i, pair) in game.table.enumerated() where pair.defense == nil {
                    guard i < slots.count, DurakGameCore.beats(card, pair.attack, trumpSuit: game.trumpSuit) else { continue }
                    let c = slots[i].defensePosition
                    let d = hypot(dropTablePos.x - c.x, dropTablePos.y - c.y)
                    if d < bestDist {
                        bestDist = d
                        targetSlot = i
                    }
                }
            }

            if let slot = targetSlot {
                return .defend(slot: slot)
            }
            if isTransferCard && (overTableLoose || isFlick) {
                return .transfer
            }
            return nil
        }

        // Attacker / throw-in
        let legalAttacks = DurakGameCore.legalAttacks(game, vm.humanId)
        let isLegal = legalAttacks.contains(where: { $0.id == card.id })
        if isLegal && (overTableLoose || isFlick || hoveredAttackSlot) {
            return .attack
        }
        return nil
    }

    private func cancelDrag(playFailureHaptic: Bool = false) {
        guard let cardNode = draggedCardNode else { return }

        tableNode.highlightDefenseSlot(at: nil)
        tableNode.highlightTransferSlot(false)
        hoveredDefenseSlotIndex = nil
        hoveredTransferSlot = false
        hoveredAttackSlot = false

        let posInHand = handNode.convert(cardNode.position, from: self)
        cardNode.removeFromParent()
        handNode.addChild(cardNode)
        cardNode.position = posInHand
        cardNode.setScale(1.0)

        if playFailureHaptic {
            FeedbackManager.shared.trigger(.failure)
        }

        handNode.returnCardToFan(cardNode)

        draggedCardNode = nil
        handNode.selectedCard = nil
        currentDragVelocityX = 0
        currentDragVelocityY = 0
    }
}
