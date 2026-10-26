/// Game engine — state creation, move application, round resolution.
///
/// 1:1 port of `packages/game-core/src/engine.ts`.

// MARK: - Constants

private let handSize = 6
private let firstBoutMaxAttacks = 5
private let maxAttacksConst = 6

// MARK: - Game Creation

public struct CreateGameOptions: Sendable {
    /// Seed for the shuffle so games are reproducible.
    public var seed: UInt32?
    /// House rules; unspecified fields use defaults (podkidnoy + all throw-in).
    public var rules: GameRules

    public init(seed: UInt32? = nil, rules: GameRules = .default) {
        self.seed = seed
        self.rules = rules
    }
}

/// Round-robin deal order at game start (one card per player per round).
public func initialDealOrder(_ playerIds: [PlayerId], handSize: Int = 6) -> [PlayerId] {
    var order: [PlayerId] = []
    order.reserveCapacity(handSize * playerIds.count)
    for _ in 0..<handSize {
        for p in playerIds {
            order.append(p)
        }
    }
    return order
}

/// Refill order after a bout: attacker, remaining attackers in seat order, defender last.
public func drawUpOrder(_ state: GameState) -> [PlayerId] {
    var order: [PlayerId] = [state.attackerId]
    var cursor = state.attackerId
    for _ in 0..<state.players.count {
        cursor = seatAfter(state, cursor, inPlayOnly: false)
        if cursor == state.attackerId { break }
        if cursor != state.defenderId {
            order.append(cursor)
        }
    }
    order.append(state.defenderId)
    return order
}

/// First attacker = holder of the lowest trump; falls back to the first seat.
private func findFirstAttacker(_ state: GameState) -> PlayerId {
    var bestPlayer: PlayerId? = nil
    var bestRank = Int.max
    for p in state.players {
        for card in handOf(state, p) {
            if isTrump(card, state.trumpSuit) && card.rank.rawValue < bestRank {
                bestRank = card.rank.rawValue
                bestPlayer = p
            }
        }
    }
    return bestPlayer ?? state.players[0]
}

public func createGame(
    playerIds: [PlayerId],
    options: CreateGameOptions = CreateGameOptions()
) -> GameState {
    precondition(playerIds.count >= 2 && playerIds.count <= 6, "Durak supports 2 to 6 players.")

    let seed = options.seed ?? UInt32.random(in: 0...UInt32.max)
    var rng = Mulberry32(seed: seed)
    var deck = shuffleDeck(buildDeck(), rng: &rng)

    let rules = options.rules

    // Bottom card fixes the trump suit and is drawn last.
    let trumpCard = deck[deck.count - 1]
    let trumpSuit = trumpCard.suit

    var hands: [PlayerId: [Card]] = [:]
    for p in playerIds { hands[p] = [] }
    for p in initialDealOrder(playerIds) {
        if !deck.isEmpty {
            hands[p]!.append(deck.removeFirst())
        }
    }

    var state = GameState(
        players: playerIds,
        hands: hands,
        deck: deck,
        trumpSuit: trumpSuit,
        trumpCard: trumpCard,
        attackerId: playerIds[0],
        defenderId: playerIds[1],
        maxAttacks: firstBoutMaxAttacks,
        rules: rules
    )

    state.attackerId = findFirstAttacker(state)
    state.defenderId = seatAfter(state, state.attackerId, inPlayOnly: false)
    return state
}

// MARK: - State Cloning

/// Deep copy of game state (for client-side undo snapshots).
public func cloneGameState(_ s: GameState) -> GameState {
    var hands: [PlayerId: [Card]] = [:]
    for p in s.players {
        hands[p] = handOf(s, p)
    }
    return GameState(
        players: s.players,
        hands: hands,
        deck: s.deck,
        trumpSuit: s.trumpSuit,
        trumpCard: s.trumpCard,
        table: s.table,
        discard: s.discard,
        attackerId: s.attackerId,
        defenderId: s.defenderId,
        takeInProgress: s.takeInProgress,
        passed: s.passed,
        finishedOrder: s.finishedOrder,
        loserId: s.loserId,
        phase: s.phase,
        maxAttacks: s.maxAttacks,
        rules: s.rules
    )
}

// MARK: - Card Manipulation

private func hasCard(_ hand: [Card], _ card: Card) -> Bool {
    hand.contains { $0.id == card.id }
}

private func removeCard(_ hand: [Card], _ card: Card) -> [Card] {
    guard let i = hand.firstIndex(where: { $0.id == card.id }) else { return hand }
    var copy = hand
    copy.remove(at: i)
    return copy
}

// MARK: - Move Application

public enum GameError: Error, Sendable {
    case gameOver
    case illegalAttack
    case onlyDefenderMayDefend
    case nothingToDefendAtPosition
    case cardCannotBeatAttack
    case onlyDefenderMayTransfer
    case illegalTransfer
    case cannotTake
    case cannotPass
    case unknownMove
}

/// Applies a move and returns the resulting state. Throws on an illegal move so
/// the same code can act as the authority on a server.
public func applyMove(_ prev: GameState, _ move: Move) throws -> GameState {
    guard prev.phase == .playing else {
        throw GameError.gameOver
    }

    var state = cloneGameState(prev)

    switch move {
    case .attack(let player, let card):
        let legal = legalAttacks(prev, player)
        guard legal.contains(where: { $0.id == card.id }) else {
            throw GameError.illegalAttack
        }
        state.hands[player] = removeCard(handOf(state, player), card)
        state.table.append(TablePair(attack: card))
        // A fresh card on the table reopens the round for everyone.
        state.passed = []

    case .defend(let player, let card, let target):
        guard player == prev.defenderId, !prev.takeInProgress else {
            throw GameError.onlyDefenderMayDefend
        }
        guard target < prev.table.count, prev.table[target].defense == nil else {
            throw GameError.nothingToDefendAtPosition
        }
        guard hasCard(handOf(prev, player), card),
              beats(card, prev.table[target].attack, trumpSuit: prev.trumpSuit) else {
            throw GameError.cardCannotBeatAttack
        }
        state.hands[player] = removeCard(handOf(state, player), card)
        state.table[target].defense = card
        resolveIfReady(&state)

    case .transfer(let player, let card, let target):
        guard player == prev.defenderId, !prev.takeInProgress else {
            throw GameError.onlyDefenderMayTransfer
        }
        let legal = legalTransfers(prev, target: target)
        guard legal.contains(where: { $0.id == card.id }) else {
            throw GameError.illegalTransfer
        }
        let oldDefender = prev.defenderId
        state.hands[player] = removeCard(handOf(state, player), card)
        state.table.append(TablePair(attack: card, viaTransfer: true))
        state.defenderId = seatAfter(state, oldDefender, inPlayOnly: true)
        state.passed = []

    case .take(let player):
        guard canTake(prev, player) else {
            throw GameError.cannotTake
        }
        state.takeInProgress = true
        state.passed = []
        resolveIfReady(&state)

    case .pass(let player):
        guard canPass(prev, player) else {
            throw GameError.cannotPass
        }
        if !state.passed.contains(player) {
            state.passed.append(player)
        }
        resolveIfReady(&state)
    }

    markFinishedPlayers(&state)
    if checkGameOver(&state) { return state }
    tryResolveZeroAttackers(&state)
    markFinishedPlayers(&state)
    _ = checkGameOver(&state)
    return state
}

// MARK: - Round Resolution (Private)

private func markFinishedPlayers(_ state: inout GameState) {
    for p in state.players {
        if handOf(state, p).isEmpty
            && state.deck.isEmpty
            && !state.finishedOrder.contains(p) {
            state.finishedOrder.append(p)
        }
    }
}

/// Resolves leftover table cards when the game ends mid-bout.
private func settleTableForGameEnd(_ state: inout GameState, soleHolder: PlayerId?) {
    for pair in state.table {
        if let sole = soleHolder, pair.defense == nil {
            state.hands[sole, default: []].append(pair.attack)
        } else {
            state.discard.append(pair.attack)
            if let def = pair.defense {
                state.discard.append(def)
            }
        }
    }
}

/// Returns true when the game has just ended (deck empty, at most one holder).
@discardableResult
private func checkGameOver(_ state: inout GameState) -> Bool {
    guard state.deck.isEmpty else { return false }

    let inPlay = state.players.filter { !handOf(state, $0).isEmpty }
    guard inPlay.count <= 1 else { return false }

    if inPlay.count == 1 {
        let sole = inPlay[0]
        let othersAllFinished = state.players
            .filter { $0 != sole }
            .allSatisfy { state.finishedOrder.contains($0) }
        if !othersAllFinished { return false }

        // Two-player end duel: let the defender answer the last attack.
        if state.players.count == 2
            && (state.table.count > 0 || state.takeInProgress) {
            let defender = state.defenderId
            if !handOf(state, defender).isEmpty
                && !state.finishedOrder.contains(defender) {
                return false
            }
        }
    }

    settleTableForGameEnd(&state, soleHolder: inPlay.first)

    state.phase = .gameOver
    state.loserId = inPlay.count == 1 ? inPlay[0] : nil
    state.table = []
    state.passed = []
    state.takeInProgress = false
    return true
}

private func assignNextRoles(_ state: inout GameState, defenderTook: Bool) {
    var newAttacker: PlayerId
    if defenderTook {
        newAttacker = seatAfter(state, state.defenderId, inPlayOnly: true)
    } else if !handOf(state, state.defenderId).isEmpty {
        newAttacker = state.defenderId
    } else {
        newAttacker = seatAfter(state, state.defenderId, inPlayOnly: true)
    }

    if handOf(state, newAttacker).isEmpty {
        newAttacker = seatAfter(state, newAttacker, inPlayOnly: true)
    }

    var newDefender = seatAfter(state, newAttacker, inPlayOnly: true)
    if handOf(state, newDefender).isEmpty {
        newDefender = seatAfter(state, newDefender, inPlayOnly: true)
    }

    state.attackerId = newAttacker
    state.defenderId = newDefender
}

/// When every attacker is out, finish or advance the bout without hanging.
private func tryResolveZeroAttackers(_ state: inout GameState) {
    guard state.phase == .playing else { return }
    let atk = attackers(state)
    guard atk.isEmpty else { return }

    // Last throw-in during TAKE emptied every attacker — complete the take
    // so the bout cannot stall with takeInProgress and nobody left to pass.
    if state.takeInProgress {
        var taken: [Card] = []
        for pair in state.table {
            taken.append(pair.attack)
            if let def = pair.defense {
                taken.append(def)
            }
        }
        state.hands[state.defenderId, default: []].append(contentsOf: taken)
        endRound(&state, defenderTook: true)
        return
    }

    if !state.table.isEmpty && undefendedCount(state) == 0 {
        for pair in state.table {
            state.discard.append(pair.attack)
            if let def = pair.defense {
                state.discard.append(def)
            }
        }
        endRound(&state, defenderTook: false)
        return
    }

    if state.table.isEmpty {
        endRound(&state, defenderTook: false)
    }
}

/// Ends the round once every attacker has passed (or the defender has taken).
private func resolveIfReady(_ state: inout GameState) {
    tryResolveZeroAttackers(&state)
    guard state.phase == .playing else { return }

    let atk = attackers(state)
    let allPassed = atk.allSatisfy { state.passed.contains($0) }
    guard allPassed else { return }

    if state.takeInProgress {
        var taken: [Card] = []
        for pair in state.table {
            taken.append(pair.attack)
            if let def = pair.defense {
                taken.append(def)
            }
        }
        state.hands[state.defenderId, default: []].append(contentsOf: taken)
        endRound(&state, defenderTook: true)
        return
    }

    if !state.table.isEmpty && undefendedCount(state) == 0 {
        for pair in state.table {
            state.discard.append(pair.attack)
            if let def = pair.defense {
                state.discard.append(def)
            }
        }
        endRound(&state, defenderTook: false)
    }
}

private func drawUp(_ state: inout GameState, defenderTook: Bool) {
    for p in drawUpOrder(state) {
        if defenderTook && p == state.defenderId {
            continue
        }
        var hand = state.hands[p] ?? []
        while hand.count < handSize && !state.deck.isEmpty {
            hand.append(state.deck.removeFirst())
        }
        state.hands[p] = hand
    }
}

private func endRound(_ state: inout GameState, defenderTook: Bool) {
    drawUp(&state, defenderTook: defenderTook)
    markFinishedPlayers(&state)

    state.table = []
    state.passed = []
    state.takeInProgress = false

    // Cap rises to 6 only after the first successful beat (discard nonempty).
    if !defenderTook && !state.discard.isEmpty && state.maxAttacks < maxAttacksConst {
        state.maxAttacks = maxAttacksConst
    }

    if checkGameOver(&state) { return }
    assignNextRoles(&state, defenderTook: defenderTook)
}

// MARK: - Public Queries

public func isGameOver(_ state: GameState) -> Bool {
    state.phase == .gameOver
}

public func getLoser(_ state: GameState) -> PlayerId? {
    state.loserId
}

/// End the match immediately because a player forfeited; forfeiter is the durak.
public func forceForfeitEnd(_ state: GameState, forfeiterId: PlayerId) -> GameState {
    precondition(state.phase != .gameOver, "Game already over")
    precondition(state.players.contains(forfeiterId), "Player not in game")

    var next = cloneGameState(state)
    let alreadyFinished = Set(next.finishedOrder)
    var finishedOrder = next.finishedOrder

    for p in next.players {
        if p == forfeiterId || alreadyFinished.contains(p) { continue }
        finishedOrder.append(p)
    }

    next.finishedOrder = finishedOrder
    next.phase = .gameOver
    next.loserId = forfeiterId
    next.table = []
    next.passed = []
    next.takeInProgress = false
    return next
}
