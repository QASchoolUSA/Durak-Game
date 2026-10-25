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

    // Economy
    var goldBalance: Int = 1000
    var creditBalance: Int = 5000

    // Hint
    var hintMessage: String? = nil
    private var hintTask: Task<Void, Never>? = nil

    // AI control
    private var aiTask: Task<Void, Never>? = nil
    private var returnTask: Task<Void, Never>? = nil

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
    private let returnWindowDuration: TimeInterval = 3.0

    // MARK: - Lifecycle

    init() {
        OnlineBridge.shared.gameVM = self
    }

    func syncOnlineView(_ view: OnlineBridge.RoomView) {
        if view.status == "lobby" {
            return
        }

        if let g = view.gameState, let yourId = view.yourPlayerId {
            self.humanId = yourId
            self.game = g
            self.playMode = .online
            if let n = view.names {
                self.names = n
            }
            if let buyIn = view.buyIn, let count = view.config?.numPlayers {
                self.pot = Int(buyIn * count)
            }
            if let d = view.config?.difficulty, let diff = AiDifficulty(rawValue: d) {
                self.difficulty = diff
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
        }
    }

    func startSoloGame() {
        cancelAI()
        cancelReturn()

        let count = min(6, max(2, numPlayers))
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
        pot = buyIn * count
        playMode = .solo
        lastMoveAt = .now

        scheduleAI()
    }

    // MARK: - Human Moves

    func submitHuman(_ move: Move) {
        guard let currentGame = game, currentGame.phase == .playing else { return }
        clearHint()

        if playMode == .online {
            if let roomId = onlineRoomId {
                if let next = try? applyMove(currentGame, move) {
                    game = next
                    lastMoveAt = .now
                }
                Task {
                    try? await OnlineBridge.shared.submitMove(roomId: roomId, move: move)
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

        if let move = timeoutMoveFor(currentGame, humanId) {
            submitHuman(move)
            return
        }

        // Optional throw-in: decline and let AI progress.
        lastMoveAt = .now
        scheduleAI()
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
    }

    func clearReturnWindow() {
        cancelReturn()
        returnSnapshot = nil
        returnExpiresAt = .distantPast
    }

    // MARK: - AI Scheduling

    private func scheduleAI() {
        guard playMode == .solo else { return }
        cancelAI()

        aiTask = Task { [weak self] in
            guard let self else { return }

            let delay = aiMoveDelayDuration(self.difficulty)
            try? await Task.sleep(for: delay)

            guard !Task.isCancelled else { return }

            await MainActor.run {
                self.executeAIMove()
            }
        }
    }

    private func scheduleAIAfterReturnWindow() {
        cancelReturn()
        returnTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(3.0))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self else { return }
                self.returnSnapshot = nil
                self.returnExpiresAt = .distantPast
                self.scheduleAI()
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
        }
    }

    private func finishGameOver(_ next: GameState) {
        cancelAI()
        game = next
        lastMoveAt = .now
        returnSnapshot = nil
        returnExpiresAt = .distantPast
    }

    func goHome() {
        cancelAI()
        cancelReturn()
        game = nil
        playMode = .solo
        onlineRoomId = nil
        onlineRoomCode = nil
        onlineIsHost = false
        pot = 0
        humanId = humanPlayerId
        names = [humanPlayerId: onlineDisplayName.trimmingCharacters(in: .whitespaces).isEmpty
                 ? "Player" : onlineDisplayName.trimmingCharacters(in: .whitespaces)]
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
        guard let g = game, g.phase == .playing else { return false }
        return DurakGameCore.canTake(g, humanId)
    }

    func canPass() -> Bool {
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
    func forfeitAndLeave() {
        cancelAI()
        cancelReturn()
        clearHint()
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

        let hand = handOf(g, humanId)
        let playable = playableCardIds()

        if playable.isEmpty {
            if canTake() {
                hintMessage = "💡 No cards can beat the table — Tap Take"
            } else if canPass() {
                hintMessage = "💡 No matching throw-ins — Tap Done"
            } else {
                hintMessage = "💡 Waiting for other players to act"
            }
        } else {
            let playableCards = hand.filter { playable.contains($0.id) }
            let sorted = playableCards.sorted { a, b in
                let aTrump = a.suit == g.trumpSuit
                let bTrump = b.suit == g.trumpSuit
                if aTrump != bTrump {
                    return !aTrump
                }
                return a.rank.rawValue < b.rank.rawValue
            }

            if let best = sorted.first {
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
                let tag = isTrump ? " (Trump)" : ""
                hintMessage = "💡 Best Move: Play \(rankSymbol)\(suitSymbol)\(tag) to preserve strength!"
            }
        }

        // Auto-dismiss after 3.5 seconds
        hintTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(3.5))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                withAnimation(.easeInOut(duration: 0.25)) {
                    self?.hintMessage = nil
                }
            }
        }
    }
}
