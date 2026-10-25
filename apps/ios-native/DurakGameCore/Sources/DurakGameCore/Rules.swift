/// Core game rules — legality checks, seat helpers, and beating logic.
///
/// 1:1 port of `packages/game-core/src/rules.ts`.

// MARK: - Card Comparison

public func isTrump(_ card: Card, _ trumpSuit: Suit) -> Bool {
    card.suit == trumpSuit
}

/// Does `defense` beat `attack` given the trump suit?
/// - same suit: higher rank wins
/// - any trump beats any non-trump
/// - trump vs trump: higher rank wins
/// - otherwise: no
public func beats(_ defense: Card, _ attack: Card, trumpSuit: Suit) -> Bool {
    let defTrump = isTrump(defense, trumpSuit)
    let atkTrump = isTrump(attack, trumpSuit)

    if defense.suit == attack.suit {
        return defense.rank > attack.rank
    }
    if defTrump && !atkTrump {
        return true
    }
    return false
}

// MARK: - Helpers

public func handOf(_ state: GameState, _ player: PlayerId) -> [Card] {
    state.hands[player] ?? []
}

public func seatAfter(_ state: GameState, _ fromId: PlayerId, inPlayOnly: Bool) -> PlayerId {
    let n = state.players.count
    guard let start = state.players.firstIndex(of: fromId) else { return fromId }
    for k in 1...n {
        let p = state.players[(start + k) % n]
        if !inPlayOnly || !handOf(state, p).isEmpty {
            return p
        }
    }
    return fromId
}

public func seatBefore(_ state: GameState, _ fromId: PlayerId) -> PlayerId {
    let n = state.players.count
    guard let start = state.players.firstIndex(of: fromId) else { return fromId }
    return state.players[((start - 1) + n) % n]
}

/// True when `player` sits immediately left or right of the defender.
public func isNeighborOfDefender(_ state: GameState, _ player: PlayerId) -> Bool {
    if player == state.defenderId { return false }
    let before = seatBefore(state, state.defenderId)
    let after = seatAfter(state, state.defenderId, inPlayOnly: false)
    return player == before || player == after
}

/// Whether `player` may throw in a matching rank this round.
public func canThrowIn(_ state: GameState, _ player: PlayerId) -> Bool {
    if player == state.defenderId { return false }
    if handOf(state, player).isEmpty { return false }
    if state.rules.throwInScope == .all { return true }
    return isNeighborOfDefender(state, player)
}

/// Players still in the game (holding cards), excluding the defender.
public func attackers(_ state: GameState) -> [PlayerId] {
    state.players.filter { p in
        p != state.defenderId && !handOf(state, p).isEmpty
    }
}

public func undefendedPairs(_ state: GameState) -> [Int] {
    var indices: [Int] = []
    for (i, pair) in state.table.enumerated() {
        if pair.defense == nil {
            indices.append(i)
        }
    }
    return indices
}

public func undefendedCount(_ state: GameState) -> Int {
    state.table.reduce(0) { n, pair in pair.defense == nil ? n + 1 : n }
}

/// Distinct ranks already present on the table (attack or defense cards).
public func tableRanks(_ state: GameState) -> Set<Rank> {
    var ranks = Set<Rank>()
    for pair in state.table {
        ranks.insert(pair.attack.rank)
        if let def = pair.defense {
            ranks.insert(def.rank)
        }
    }
    return ranks
}

// MARK: - Legal Move Generators

/// Cards `player` may legally play as an attack/throw-in right now.
/// - empty table: only the primary attacker, any card
/// - non-empty table: eligible throwers only, matching ranks,
///   subject to the round cap and the defender's capacity to respond.
public func legalAttacks(_ state: GameState, _ player: PlayerId) -> [Card] {
    guard state.phase == .playing else { return [] }

    let hand = handOf(state, player)
    if hand.isEmpty { return [] }

    // Opening attack.
    if state.table.isEmpty {
        if player != state.attackerId || state.takeInProgress { return [] }
        return hand
    }

    // Throw-in: must be eligible and not the defender.
    if player == state.defenderId || !canThrowIn(state, player) { return [] }
    if state.table.count >= state.maxAttacks { return [] }

    // Can't pile on more undefended attacks than the defender holds.
    let defenderHand = handOf(state, state.defenderId).count
    if undefendedCount(state) >= defenderHand { return [] }

    let ranks = tableRanks(state)
    return hand.filter { ranks.contains($0.rank) }
}

/// For a given undefended attack, the defender's cards that can beat it.
public func legalDefenses(_ state: GameState, target: Int) -> [Card] {
    guard state.phase == .playing, !state.takeInProgress else { return [] }
    guard target < state.table.count else { return [] }
    let pair = state.table[target]
    guard pair.defense == nil else { return [] }
    let hand = handOf(state, state.defenderId)
    return hand.filter { beats($0, pair.attack, trumpSuit: state.trumpSuit) }
}

/// True while defenders may keep passing the attack via matching-rank transfers.
public func transferChainActive(_ state: GameState) -> Bool {
    if state.table.isEmpty { return false }
    if state.table.contains(where: { $0.defense != nil }) { return false }
    if state.table.count == 1 { return true }
    let openingRank = state.table[0].attack.rank
    for i in 1..<state.table.count {
        let p = state.table[i]
        if !p.viaTransfer || p.attack.rank != openingRank { return false }
    }
    return true
}

/// Perevodnoy: defender plays same rank as the opening attack to pass defense on.
/// Allowed only on the opening card while the chain has no throw-ins or defenses.
public func legalTransfers(_ state: GameState, target: Int) -> [Card] {
    guard state.rules.variant == .perevodnoy else { return [] }
    guard state.phase == .playing, !state.takeInProgress else { return [] }
    guard target == 0 else { return [] }
    guard transferChainActive(state) else { return [] }

    guard let opening = state.table.first, opening.defense == nil else { return [] }
    guard state.table.count < state.maxAttacks else { return [] }

    let nextDef = seatAfter(state, state.defenderId, inPlayOnly: true)
    let futureUndefended = undefendedCount(state) + 1
    guard handOf(state, nextDef).count >= futureUndefended else { return [] }

    let openingRank = opening.attack.rank
    let hand = handOf(state, state.defenderId)
    return hand.filter { $0.rank == openingRank }
}

public func canTransfer(_ state: GameState, _ player: PlayerId) -> Bool {
    guard player == state.defenderId else { return false }
    return !legalTransfers(state, target: 0).isEmpty
}

public func canTake(_ state: GameState, _ player: PlayerId) -> Bool {
    state.phase == .playing
        && player == state.defenderId
        && !state.takeInProgress
        // Only takeable while at least one attack is still unbeaten.
        && undefendedCount(state) > 0
}

/// An attacker may declare "done" only when there are no undefended attacks waiting.
public func canPass(_ state: GameState, _ player: PlayerId) -> Bool {
    guard state.phase == .playing else { return false }
    if player == state.defenderId { return false }
    if handOf(state, player).isEmpty && player != state.attackerId {
        return false
    }
    if state.table.isEmpty { return false }
    if state.passed.contains(player) { return false }
    if !state.takeInProgress && undefendedCount(state) > 0 { return false }
    return true
}
