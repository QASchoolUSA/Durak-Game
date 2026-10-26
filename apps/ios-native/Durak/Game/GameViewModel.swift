import SwiftUI
import DurakGameCore

/// Core game view model — owns the game state, drives AI, manages undo window.
///
/// Port of `apps/mobile/src/game/store.ts`.
@Observable
@MainActor
final class GameViewModel {
    // MARK: - Published State

    var game: GameState? = nil
    var playMode: PlayMode = .solo
    var numPlayers: Int = 2
    var variant: GameVariant = .podkidnoy
    var throwInScope: ThrowInScope = .all
    var playStyle: PlayStyle = .standard
    var difficulty: AiDifficulty = .medium
    var humanId: PlayerId = "you"
    var names: [PlayerId: String] = ["you": "Player"]
    var pot: Int = 0
    var buyIn: Int = 100

    // Return (undo) window
    var returnSnapshot: GameState? = nil
    var returnExpiresAt: Date = .distantPast

    // Turn clock
    var turnDeadlineAt: Date? = nil
    var turnClockPlayerId: PlayerId? = nil
    var turnTimerSeconds: Int = 12
    var lastMoveAt: Date = .now

    // Online
    var onlineRoomId: String? = nil
    var onlineRoomCode: String? = nil
    var onlineIsHost: Bool = false
    var onlineDisplayName: String = "Player"
    /// True while an online move is in flight (blocks double-taps).
    var isSubmittingOnlineMove: Bool = false
    /// Short user-facing online sync / move error (cleared on next successful sync).
    var onlineNotice: String? = nil
    /// Soft banner when RTT / poll failures look bad (not a hard error).
    var slowConnectionNotice: String? = nil
    /// True when the turn-clock owner looks reconnecting (from server view).
    var opponentReconnecting: Bool = false
    /// Server version observed before the in-flight optimistic move.
    private(set) var pendingSubmitBaseVersion: Int? = nil

    // Economy
    var goldBalance: Int = 1000
    var creditBalance: Int = 5000
    /// Solo buy-in already deducted for the current match.
    private(set) var soloBuyInCharged: Bool = false
    /// One-shot settlement key for the finished solo match (`lastMoveAt:loser:order`).
    private var soloEconomySettledKey: String? = nil
    /// Surface when solo start fails for insufficient credits.
    var economyNotice: String? = nil

    // Hint
    var hintMessage: String? = nil
    private var hintTask: Task<Void, Never>? = nil

    // AI control
    private var aiTask: Task<Void, Never>? = nil
    private var returnTask: Task<Void, Never>? = nil
    /// Solo turn-clock timeout that calls `autoPlayHuman` when the ring expires.
    private var turnTimeoutTask: Task<Void, Never>? = nil
    /// Snapshot used to roll back a failed online optimistic apply.
    private var onlineMoveRollback: GameState? = nil
    private var pendingClientMoveId: String? = nil
    private var pendingSubmitStartedAt: Date? = nil
    /// True once `submitMove` HTTP returns success; version gate then finishes reconcile.
    private var pendingMutationSettled: Bool = false

    // Online reactions (from `rooms.recentReaction`)
    struct RemoteReaction: Equatable, Sendable {
        let emoji: String
        let fromPlayerId: PlayerId
        let at: TimeInterval
    }
    var remoteReaction: RemoteReaction? = nil

    enum PlayMode: Sendable { case solo, online }

    /// True once the human emptied their hand with the deck empty (`finishedOrder`).
    var isHumanFinished: Bool {
        guard let g = game else { return false }
        return g.finishedOrder.contains(humanId)
    }

    /// Finished human while others are still playing.
    var isSpectator: Bool {
        isHumanFinished && game?.phase == .playing
    }

    /// Remaining in-play opponents (for solo spectator face-up hands).
    var spectatorRemainingPlayerIds: [PlayerId] {
        guard let g = game, isSpectator else { return [] }
        return g.players.filter { p in
            p != humanId && !g.finishedOrder.contains(p) && !handOf(g, p).isEmpty
        }
    }

    // MARK: - Constants

    private let humanPlayerId: PlayerId = "you"
    private let botNames = ["Olga", "Ivan", "Dmitri", "Maria", "Sergey"]
    private let returnWindowDuration: TimeInterval = 1.15

    // MARK: - Lifecycle

    init() {
        OnlineBridge.shared.gameVM = self
    }

    func syncOnlineView(_ view: OnlineBridge.RoomView) {
        if view.status == "lobby" {
            return
        }

        // Keep room identity in sync so leave/forfeit and submitMove always have an id.
        onlineRoomId = view.roomId
        onlineRoomCode = view.code
        onlineIsHost = view.isHost

        let viewVersion = view.version.map { Int($0) }
        opponentReconnecting = view.turnClockConnection == "reconnecting"
            && view.turnClockPlayerId != humanId
            && view.turnClockPlayerId != nil

        // Ack-gated: keep optimism until the mutation settles AND version advances.
        // (Reactions also bump version — do not clear on version alone while HTTP is open.)
        if isSubmittingOnlineMove, let base = pendingSubmitBaseVersion {
            let versionAdvanced = (viewVersion ?? base) > base
            if !pendingMutationSettled || !versionAdvanced {
                applyOnlineMeta(from: view)
                applyRemoteReaction(from: view)
                refreshSlowConnectionHint()
                return
            }
            clearPendingOnlineSubmit()
            onlineNotice = nil
        } else if !isSubmittingOnlineMove {
            onlineNotice = nil
        }

        applyOnlineMeta(from: view)
        applyRemoteReaction(from: view)

        if let g = view.gameState, let yourId = view.yourPlayerId {
            self.humanId = yourId
            self.game = g
            self.playMode = .online
            if let n = view.names {
                self.names = n
            }
            if let buyIn = view.buyIn {
                let humans = view.members.filter { !$0.isBot }.count
                let seats = humans > 0 ? humans : Int(view.config?.numPlayers ?? 0)
                self.pot = Int(buyIn) * max(0, seats)
            }
            if let d = view.config?.difficulty, let diff = AiDifficulty(rawValue: d) {
                self.difficulty = diff
            }
        } else if view.status == "finished" {
            // Finished without payload — still mark online so Result can show.
            self.playMode = .online
        }

        refreshSlowConnectionHint()
    }

    private func applyOnlineMeta(from view: OnlineBridge.RoomView) {
        if let timer = view.turnTimerSeconds {
            self.turnTimerSeconds = Int(timer)
        }
        if let deadline = view.turnDeadlineAt {
            self.turnDeadlineAt = Date(timeIntervalSince1970: deadline / 1000.0)
        } else {
            self.turnDeadlineAt = nil
        }
        self.turnClockPlayerId = view.turnClockPlayerId
        if let lastMove = view.lastMoveAt {
            self.lastMoveAt = Date(timeIntervalSince1970: lastMove / 1000.0)
        }
        if let style = view.config?.playStyle, let parsed = PlayStyle(rawValue: style) {
            self.playStyle = parsed
        }
    }

    private func applyRemoteReaction(from view: OnlineBridge.RoomView) {
        guard let reaction = view.recentReaction else { return }
        let at = reaction.at / 1000.0
        if let existing = remoteReaction, abs(existing.at - at) < 0.001 { return }
        remoteReaction = RemoteReaction(
            emoji: reaction.emoji,
            fromPlayerId: reaction.fromPlayerId,
            at: at
        )
    }

    private func clearPendingOnlineSubmit() {
        onlineMoveRollback = nil
        isSubmittingOnlineMove = false
        pendingClientMoveId = nil
        pendingSubmitBaseVersion = nil
        pendingSubmitStartedAt = nil
        pendingMutationSettled = false
        slowConnectionNotice = nil
    }

    /// Called when a live/poll view arrives after mutation success may already be settled.
    func noteOnlineVersionAdvancedIfReady() {
        guard isSubmittingOnlineMove, pendingMutationSettled else { return }
        guard let base = pendingSubmitBaseVersion else { return }
        if OnlineBridge.shared.lastAppliedVersionForUI > base {
            clearPendingOnlineSubmit()
        }
    }

    private func refreshSlowConnectionHint() {
        if let started = pendingSubmitStartedAt,
           isSubmittingOnlineMove,
           Date().timeIntervalSince(started) >= 1.5 {
            slowConnectionNotice = String(localized: "Slow connection — still sending…")
        } else if OnlineBridge.shared.consecutiveFailuresForUI >= 2 {
            slowConnectionNotice = String(localized: "Slow connection")
        } else if OnlineBridge.shared.syncErrorMessage != nil {
            slowConnectionNotice = nil
        } else {
            slowConnectionNotice = nil
        }
    }

    /// Called when poll determines we are no longer a room member.
    func handleOnlineEviction() {
        cancelAI()
        cancelReturn()
        clearHint()
        clearPendingOnlineSubmit()
        opponentReconnecting = false
        onlineNotice = OnlineBridge.shared.syncErrorMessage ?? String(localized: "Left the table.")
        game = nil
        playMode = .solo
        onlineRoomId = nil
        onlineRoomCode = nil
        onlineIsHost = false
        turnDeadlineAt = nil
        turnClockPlayerId = nil
        remoteReaction = nil
        cancelTurnTimeout()
    }

    /// Starts a solo match after deducting buy-in. Returns false if credits are insufficient.
    @discardableResult
    func startSoloGame() async -> Bool {
        cancelAI()
        cancelReturn()
        OnlineBridge.shared.clearLocalRoomSession()
        economyNotice = nil

        let count = min(6, max(2, numPlayers))
        let stake = max(0, buyIn)

        if ConvexAuth.shared.hasWalletSession {
            do {
                try await ConvexAuth.shared.spendCredits(amount: stake, reason: "buy_in")
            } catch {
                economyNotice = String(localized: "Not enough credits for buy-in (\(stake)).")
                return false
            }
        } else {
            guard EconomyStore.shared.deductCredits(stake) else {
                economyNotice = String(localized: "Not enough credits for buy-in (\(stake)).")
                return false
            }
        }

        beginSoloMatch(playerCount: count, stake: stake)
        return true
    }

    private func beginSoloMatch(playerCount count: Int, stake: Int) {
        let humanName = onlineDisplayName.trimmingCharacters(in: .whitespaces)

        var ids: [PlayerId] = [humanPlayerId]
        var playerNames: [PlayerId: String] = [humanPlayerId: humanName.isEmpty ? "Player" : humanName]
        for i in 0..<(count - 1) {
            let id = "bot\(i + 1)"
            ids.append(id)
            playerNames[id] = i < botNames.count ? botNames[i] : "Bot \(i + 1)"
        }

        let seed = UInt32.random(in: 0...UInt32.max)
        let newGame = createGame(
            playerIds: ids,
            options: CreateGameOptions(
                seed: seed,
                rules: GameRules(variant: variant, throwInScope: throwInScope, playStyle: playStyle)
            )
        )

        humanId = humanPlayerId
        names = playerNames
        game = newGame
        pot = matchPot(numPlayers: count, buyIn: stake)
        playMode = .solo
        lastMoveAt = .now
        soloBuyInCharged = true
        soloEconomySettledKey = nil

        scheduleAI()
        refreshSoloTurnClock()
    }

    /// Display-only credit delta for Result UI (does not mutate balances).
    func soloResultCreditDeltaDisplay() -> Int {
        guard playMode == .solo, let game, game.phase == .gameOver else { return 0 }
        return soloMatchEndCreditDelta(
            isDraw: game.loserId == nil,
            humanIsWinner: game.finishedOrder.first == humanId,
            numPlayers: game.players.count,
            buyIn: buyIn
        )
    }

    /// One-shot solo credit settlement (mirrors RN `settleSoloEconomy`). Winner gets full pot;
    /// draw refunds buy-in; loser already paid at start. Uses Convex when a session exists.
    @discardableResult
    func settleSoloEconomyIfNeeded() async -> Int {
        guard playMode == .solo, soloBuyInCharged else { return 0 }
        guard let game, game.phase == .gameOver else { return 0 }

        let key = "\(lastMoveAt.timeIntervalSince1970):\(game.loserId ?? "draw"):\(game.finishedOrder.joined(separator: ","))"
        if soloEconomySettledKey == key { return 0 }

        let delta = soloMatchEndCreditDelta(
            isDraw: game.loserId == nil,
            humanIsWinner: game.finishedOrder.first == humanId,
            numPlayers: game.players.count,
            buyIn: buyIn
        )
        soloEconomySettledKey = key
        guard delta > 0 else { return 0 }

        let reason = game.loserId == nil ? "draw_refund" : "win_pot"
        if ConvexAuth.shared.hasWalletSession {
            do {
                try await ConvexAuth.shared.awardCredits(amount: delta, reason: reason)
            } catch {
                EconomyStore.shared.adjustCredits(delta)
            }
        } else {
            EconomyStore.shared.adjustCredits(delta)
        }
        return delta
    }

    // MARK: - Human Moves

    func submitHuman(_ move: Move) {
        guard let currentGame = game, currentGame.phase == .playing else { return }
        clearHint()

        if playMode == .online {
            guard let roomId = onlineRoomId else { return }
            guard !isSubmittingOnlineMove else { return }

            // Optimistic apply for snappy UI; server + poll are authoritative.
            let rollback = currentGame
            let clientMoveId = UUID().uuidString
            let baseVersion = OnlineBridge.shared.lastAppliedVersionForUI
            if let next = try? applyMove(currentGame, move) {
                onlineMoveRollback = rollback
                game = next
                lastMoveAt = .now
            }
            isSubmittingOnlineMove = true
            pendingClientMoveId = clientMoveId
            pendingSubmitBaseVersion = baseVersion
            pendingSubmitStartedAt = .now
            pendingMutationSettled = false
            onlineNotice = nil
            slowConnectionNotice = nil

            // Soft "slow connection" if confirm takes too long.
            Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(1500))
                await MainActor.run {
                    self?.refreshSlowConnectionHint()
                }
            }

            Task { [weak self] in
                guard let self else { return }
                do {
                    try await OnlineBridge.shared.submitMove(
                        roomId: roomId,
                        move: move,
                        clientMoveId: clientMoveId
                    )
                    await MainActor.run {
                        guard self.pendingClientMoveId == clientMoveId else { return }
                        self.pendingMutationSettled = true
                        self.refreshSlowConnectionHint()
                        // pollNow may already have landed a newer version.
                        self.noteOnlineVersionAdvancedIfReady()
                    }
                } catch {
                    await MainActor.run {
                        guard self.pendingClientMoveId == clientMoveId else { return }
                        if let snap = self.onlineMoveRollback {
                            self.game = snap
                        }
                        self.clearPendingOnlineSubmit()
                        self.onlineNotice = String(localized: "Move didn’t go through — try again.")
                        FeedbackManager.shared.trigger(.failure)
                        OnlineBridge.shared.pollNow()
                    }
                }
            }
            return
        }

        let isCardPlay = isHumanCardMove(move)

        do {
            let snapshot = isCardPlay ? cloneGameState(currentGame) : nil
            let next = try applyMove(currentGame, move)

            cancelReturn()

            if next.phase == .gameOver {
                finishGameOver(next)
                return
            }

            if isCardPlay, let snapshot {
                cancelAI()
                game = next
                lastMoveAt = .now
                returnSnapshot = snapshot
                returnExpiresAt = Date().addingTimeInterval(returnWindowDuration)
                scheduleAIAfterReturnWindow()
                refreshSoloTurnClock()
                return
            }

            afterApply(next)
        } catch {
            // Illegal move — ignore
        }
    }

    func autoPlayHuman() {
        guard playMode == .solo else { return }
        guard let currentGame = game, currentGame.phase == .playing else { return }

        cancelTurnTimeout()

        if let move = timeoutMoveFor(currentGame, humanId) {
            submitHuman(move)
            return
        }

        // Optional throw-in: decline and let AI progress.
        lastMoveAt = .now
        scheduleAI()
        refreshSoloTurnClock()
    }

    func returnLastCard() {
        guard playMode == .solo else { return }
        guard let snapshot = returnSnapshot, Date() < returnExpiresAt else { return }

        cancelReturn()
        cancelAI()
        game = snapshot
        lastMoveAt = .now
        returnSnapshot = nil
        returnExpiresAt = .distantPast
        scheduleAI()
        refreshSoloTurnClock()
    }

    func clearReturnWindow() {
        cancelReturn()
        returnSnapshot = nil
        returnExpiresAt = .distantPast
    }

    // MARK: - AI Scheduling

    private func scheduleAI(immediate: Bool = false) {
        guard playMode == .solo else { return }
        cancelAI()

        aiTask = Task { [weak self] in
            guard let self else { return }

            let delay: Duration = immediate ? .milliseconds(180) : aiMoveDelayDuration(self.difficulty)
            try? await Task.sleep(for: delay)

            guard !Task.isCancelled else { return }

            await MainActor.run {
                self.executeAIMove()
            }
        }
    }

    private func scheduleAIAfterReturnWindow() {
        cancelReturn()
        let windowSeconds = returnWindowDuration
        returnTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(windowSeconds))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self else { return }
                self.returnSnapshot = nil
                self.returnExpiresAt = .distantPast
                self.scheduleAI(immediate: true)
            }
        }
    }

    private func executeAIMove() {
        guard let currentGame = game, currentGame.phase == .playing else { return }

        // Check perevodnoy transfer window for human defender.
        if currentGame.rules.variant == .perevodnoy
            && currentGame.defenderId == humanId
            && !currentGame.takeInProgress
            && currentGame.table.count == 1
            && undefendedCount(currentGame) > 0 {
            return
        }

        if canTransfer(currentGame, humanId) { return }

        for p in currentGame.players {
            if p == humanId { continue }
            if let move = pickMove(currentGame, p, difficulty: difficulty) {
                do {
                    let next = try applyMove(currentGame, move)
                    afterApply(next)
                } catch {
                    // ignore
                }
                return
            }
        }
    }

    private func cancelAI() {
        aiTask?.cancel()
        aiTask = nil
    }

#if DEBUG
    /// Stops pending bot moves (layout / screenshot launch args).
    func debugCancelAI() {
        cancelAI()
    }
#endif

    private func cancelReturn() {
        returnTask?.cancel()
        returnTask = nil
    }

    // MARK: - State Transitions

    private func afterApply(_ next: GameState) {
        clearReturnWindow()

        if next.phase == .gameOver {
            finishGameOver(next)
            return
        }

        game = next
        lastMoveAt = .now

        if playMode == .solo {
            scheduleAI()
            refreshSoloTurnClock()
        }
    }

    private func finishGameOver(_ next: GameState) {
        cancelAI()
        cancelTurnTimeout()
        game = next
        lastMoveAt = .now
        returnSnapshot = nil
        returnExpiresAt = .distantPast
        turnDeadlineAt = nil
        turnClockPlayerId = nil
        // Settle as soon as the match ends so Settings/EconomyBar update before Result.
        Task { _ = await settleSoloEconomyIfNeeded() }
    }

    func goHome() {
        cancelAI()
        cancelReturn()
        cancelTurnTimeout()
        clearHint()
        OnlineBridge.shared.clearLocalRoomSession()
        clearPendingOnlineSubmit()
        opponentReconnecting = false
        onlineNotice = nil
        economyNotice = nil
        soloBuyInCharged = false
        soloEconomySettledKey = nil
        game = nil
        playMode = .solo
        onlineRoomId = nil
        onlineRoomCode = nil
        onlineIsHost = false
        turnDeadlineAt = nil
        turnClockPlayerId = nil
        remoteReaction = nil
        pot = 0
        humanId = humanPlayerId
        names = [humanPlayerId: onlineDisplayName.trimmingCharacters(in: .whitespaces).isEmpty
                 ? "Player" : onlineDisplayName.trimmingCharacters(in: .whitespaces)]
    }

    // MARK: - Solo turn clock

    /// Arms / clears the solo human timeout so the turn ring is enforceable, not cosmetic.
    private func refreshSoloTurnClock() {
        cancelTurnTimeout()
        guard playMode == .solo else { return }
        guard let current = game, current.phase == .playing else {
            turnDeadlineAt = nil
            turnClockPlayerId = nil
            return
        }
        guard humanMustAct(current, humanId), !current.finishedOrder.contains(humanId) else {
            turnDeadlineAt = nil
            turnClockPlayerId = nil
            return
        }

        let seconds = max(1, turnTimerSeconds)
        let deadline = lastMoveAt.addingTimeInterval(TimeInterval(seconds))
        turnClockPlayerId = humanId
        turnDeadlineAt = deadline

        let remaining = deadline.timeIntervalSinceNow
        if remaining <= 0.05 {
            autoPlayHuman()
            return
        }

        turnTimeoutTask = Task { [weak self] in
            let ns = UInt64(remaining * 1_000_000_000)
            try? await Task.sleep(nanoseconds: ns)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.autoPlayHuman()
            }
        }
    }

    private func cancelTurnTimeout() {
        turnTimeoutTask?.cancel()
        turnTimeoutTask = nil
    }

    // MARK: - Helpers

    private func isHumanCardMove(_ move: Move) -> Bool {
        switch move {
        case .attack(let p, _), .defend(let p, _, _), .transfer(let p, _, _):
            return p == humanId
        default:
            return false
        }
    }

    /// Whether the human player has a legal action right now.
    var humanCanAct: Bool {
        guard let g = game, g.phase == .playing else { return false }
        return humanMustAct(g, humanId)
    }

    /// Whether the return (undo) button should be shown.
    var canReturn: Bool {
        returnSnapshot != nil && Date() < returnExpiresAt
    }

    /// Set of card IDs that the human player can legally play right now.
    func playableCardIds() -> Set<String> {
        guard let g = game, g.phase == .playing else { return [] }
        let hand = handOf(g, humanId)
        var playable = Set<String>()

        if g.defenderId == humanId {
            // Defenses against undefended table pairs
            for pair in g.table where pair.defense == nil {
                for card in hand {
                    if DurakGameCore.beats(card, pair.attack, trumpSuit: g.trumpSuit) {
                        playable.insert(card.id)
                    }
                }
            }

            // Transfers
            if g.rules.variant == .perevodnoy && DurakGameCore.canTransfer(g, humanId) {
                let transfers = DurakGameCore.legalTransfers(g, target: 0)
                for card in transfers {
                    playable.insert(card.id)
                }
            }
        } else {
            // Attacks / Throw-ins
            let attacks = DurakGameCore.legalAttacks(g, humanId)
            for card in attacks {
                playable.insert(card.id)
            }
        }

        return playable
    }

    func canTake() -> Bool {
        guard !isHumanFinished else { return false }
        guard !isSubmittingOnlineMove else { return false }
        guard let g = game, g.phase == .playing else { return false }
        return DurakGameCore.canTake(g, humanId)
    }

    func canPass() -> Bool {
        guard !isHumanFinished else { return false }
        guard !isSubmittingOnlineMove else { return false }
        guard let g = game, g.phase == .playing else { return false }
        return DurakGameCore.canPass(g, humanId)
    }

    func forfeit() {
        guard let g = game, g.phase == .playing else { return }
        cancelAI()
        cancelReturn()
        let ended = forceForfeitEnd(g, forfeiterId: humanId)
        finishGameOver(ended)
    }

    /// Exits the game cleanly upon user forfeit without navigating to the game over screen.
    /// Awaits server `rooms:forfeit` first so Home Resume cannot race a still-playing seat.
    func forfeitAndLeave() async {
        cancelAI()
        cancelReturn()
        clearHint()
        let roomId = onlineRoomId
        let wasOnlinePlaying = playMode == .online && roomId != nil
        if wasOnlinePlaying, let roomId {
            await OnlineBridge.shared.forfeit(roomId: roomId)
        }
        game = nil
        goHome()
    }

    func clearHint() {
        hintTask?.cancel()
        hintTask = nil
        hintMessage = nil
    }

    func requestStrategicHint() {
        guard let g = game, g.phase == .playing else { return }
        clearHint()

        let guidance = makeStrategicHintGuidance(for: g)
        hintMessage = "💡 Thinking…"

        hintTask = Task { [weak self] in
            let refined = await HintCoach.refine(guidance)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self else { return }
                withAnimation(.easeInOut(duration: 0.2)) {
                    self.hintMessage = refined
                }
            }

            try? await Task.sleep(for: .seconds(3.5))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.25)) {
                    self?.hintMessage = nil
                }
            }
        }
    }

    /// Deterministic hint used as FM fallback and as the action the coach must not contradict.
    private func makeStrategicHintGuidance(for g: GameState) -> HintCoach.Guidance {
        let variantName = g.rules.variant == .perevodnoy ? "Perevodnoy" : "Podkidnoy"
        let hand = handOf(g, humanId)
        let playable = playableCardIds()

        if playable.isEmpty {
            if canTake() {
                return HintCoach.Guidance(
                    cannedMessage: "💡 No cards can beat the table — Tap Take",
                    cardLabel: nil,
                    actionKind: "take",
                    isTrump: false,
                    variantName: variantName
                )
            }
            if canPass() {
                return HintCoach.Guidance(
                    cannedMessage: "💡 No matching throw-ins — Tap Done",
                    cardLabel: nil,
                    actionKind: "pass",
                    isTrump: false,
                    variantName: variantName
                )
            }
            return HintCoach.Guidance(
                cannedMessage: "💡 Waiting for other players to act",
                cardLabel: nil,
                actionKind: "wait",
                isTrump: false,
                variantName: variantName
            )
        }

        let playableCards = hand.filter { playable.contains($0.id) }
        let sorted = playableCards.sorted { a, b in
            let aTrump = a.suit == g.trumpSuit
            let bTrump = b.suit == g.trumpSuit
            if aTrump != bTrump {
                return !aTrump
            }
            return a.rank.rawValue < b.rank.rawValue
        }

        guard let best = sorted.first else {
            return HintCoach.Guidance(
                cannedMessage: "💡 Waiting for other players to act",
                cardLabel: nil,
                actionKind: "wait",
                isTrump: false,
                variantName: variantName
            )
        }

        let rankSymbol: String
        switch best.rank {
        case .six: rankSymbol = "6"
        case .seven: rankSymbol = "7"
        case .eight: rankSymbol = "8"
        case .nine: rankSymbol = "9"
        case .ten: rankSymbol = "10"
        case .jack: rankSymbol = "J"
        case .queen: rankSymbol = "Q"
        case .king: rankSymbol = "K"
        case .ace: rankSymbol = "A"
        }

        let suitSymbol: String
        switch best.suit {
        case .spades: suitSymbol = "♠"
        case .hearts: suitSymbol = "♥"
        case .diamonds: suitSymbol = "♦"
        case .clubs: suitSymbol = "♣"
        }

        let isTrump = best.suit == g.trumpSuit
        let label = "\(rankSymbol)\(suitSymbol)"
        let tag = isTrump ? " (Trump)" : ""
        return HintCoach.Guidance(
            cannedMessage: "💡 Best Move: Play \(label)\(tag) to preserve strength!",
            cardLabel: label,
            actionKind: "play",
            isTrump: isTrump,
            variantName: variantName
        )
    }
}
