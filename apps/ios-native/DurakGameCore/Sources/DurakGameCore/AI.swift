/// AI player — heuristic-based move selection with difficulty-scaled search.
///
/// 1:1 port of `packages/game-core/src/ai.ts`.

// MARK: - Difficulty

public enum AiDifficulty: String, Codable, Sendable, CaseIterable {
    case easy, medium, hard
}

private let maxCandidates: [AiDifficulty: Int] = [
    .easy: 4, .medium: 6, .hard: 8,
]

/// Search depth after the candidate move is applied.
private let searchDepth: [AiDifficulty: Int] = [
    .easy: 0, .medium: 1, .hard: 2,
]

// MARK: - Evaluation

/// Trumps are worth holding on to, so they sort as more valuable.
private func cardValue(_ card: Card, _ trumpSuit: Suit) -> Int {
    card.rank.rawValue + (isTrump(card, trumpSuit) ? 100 : 0)
}

private func rankCountInHand(_ hand: [Card], _ rank: Rank) -> Int {
    hand.filter { $0.rank == rank }.count
}

private func pileSize(_ state: GameState) -> Int {
    state.table.reduce(0) { n, p in n + 1 + (p.defense != nil ? 1 : 0) }
}

/// Position score from `me`'s perspective. Higher is better.
/// Captures hand quality, endgame pressure, bout outcomes, and trump inventory.
public func evaluatePosition(_ state: GameState, me: PlayerId) -> Int {
    if state.phase == .gameOver {
        if state.loserId == me { return -100_000 }
        if let idx = state.finishedOrder.firstIndex(of: me) {
            return 50_000 - idx * 1_000
        }
        return 0
    }

    let trumpSuit = state.trumpSuit
    let hand = handOf(state, me)
    var score = 0

    // Prefer fewer cards; amplify when the deck is thin or empty.
    let deckLen = state.deck.count
    let handSizeWeight = deckLen == 0 ? 180 : deckLen <= 6 ? 80 : 45
    score -= hand.count * handSizeWeight

    for c in hand {
        if isTrump(c, trumpSuit) {
            // Trump inventory is an asset (especially mid/high).
            score += 25 + c.rank.rawValue * 2
        } else if c.rank.rawValue <= 8 {
            // Low non-trumps are useful attack ammo — mild asset to hold.
            score += 6
        } else {
            // High non-trumps are mild liabilities.
            score -= (c.rank.rawValue - 8) * 2
        }
    }

    // Opponents holding many cards is good for us.
    for p in state.players {
        if p == me { continue }
        let oppLen = handOf(state, p).count
        score += oppLen * (deckLen == 0 ? 90 : 28)
        if deckLen == 0 {
            if oppLen == 0 { score -= 40 }
            else if oppLen == 1 { score -= 25 }
        }
    }

    // Under fire as defender: each uncovered attack is pressure.
    if me == state.defenderId && !state.table.isEmpty {
        score -= undefendedCount(state) * 35
        if state.takeInProgress {
            score -= pileSize(state) * 55
        }
    }

    // Pending take: treat the pile as cards the defender is about to receive.
    if state.takeInProgress && me != state.defenderId {
        score += pileSize(state) * 50
    }

    return score
}

// MARK: - Heuristics

/// Immediate preference for opening leads (lower is better).
private func openingHeuristic(_ card: Card, _ hand: [Card], _ trumpSuit: Suit) -> Int {
    var h = cardValue(card, trumpSuit)
    if isTrump(card, trumpSuit) {
        h += 80
    } else {
        h -= (rankCountInHand(hand, card.rank) - 1) * 8
    }
    return h
}

/// Immediate preference for throw-ins (lower is better).
private func throwInHeuristic(_ card: Card, _ state: GameState, _ player: PlayerId) -> Int {
    let trumpSuit = state.trumpSuit
    var h = cardValue(card, trumpSuit)
    let hand = handOf(state, player)
    let emptiesHand = hand.count == 1

    if isTrump(card, trumpSuit) {
        if emptiesHand || state.takeInProgress {
            h -= 20
        } else {
            h += 60
        }
    }

    if emptiesHand { h -= 100 }
    return h
}

/// Immediate preference for defense beats (lower is better).
private func defendHeuristic(_ card: Card, _ trumpSuit: Suit) -> Int {
    cardValue(card, trumpSuit)
}

/// Immediate preference for transfers (lower is better).
private func transferHeuristic(_ card: Card, _ state: GameState, _ player: PlayerId) -> Int {
    let nextDef = seatAfter(state, player, inPlayOnly: true)
    let nextHand = handOf(state, nextDef).count
    var h = cardValue(card, state.trumpSuit)
    if nextHand <= 2 { h -= 40 }
    else if nextHand <= 4 { h -= 10 }
    if !isTrump(card, state.trumpSuit) && card.rank.rawValue >= 10 { h -= 5 }
    return h
}

// MARK: - Candidate Generation

private struct ScoredMove: Sendable {
    let move: Move
    /// Lower is better for pre-ranking before search.
    let heuristic: Int
}

private func moveKey(_ move: Move) -> String {
    switch move {
    case .attack(_, let card): return "A:\(card.id)"
    case .defend(_, let card, let target): return "D:\(target):\(card.id)"
    case .transfer(_, let card, let target): return "T:\(target):\(card.id)"
    case .take: return "TAKE"
    case .pass: return "PASS"
    }
}

private func generateDefenderCandidates(
    _ state: GameState, _ player: PlayerId, _ difficulty: AiDifficulty
) -> [ScoredMove] {
    if state.takeInProgress { return [] }
    let undef = undefendedPairs(state)
    if undef.isEmpty { return [] }

    var out: [ScoredMove] = []
    var seen = Set<String>()

    func push(_ move: Move, _ heuristic: Int) {
        let key = moveKey(move)
        guard !seen.contains(key) else { return }
        seen.insert(key)
        out.append(ScoredMove(move: move, heuristic: heuristic))
    }

    // Easy give-up: only high-trump beats left with multiple uncovered attacks.
    if difficulty == .easy && canTake(state, player) {
        var anyBeater = false
        var allHighTrump = true
        for target in undef {
            let beaters = legalDefenses(state, target: target)
            if beaters.isEmpty {
                allHighTrump = false
                continue
            }
            anyBeater = true
            for b in beaters {
                if !isTrump(b, state.trumpSuit) || b.rank.rawValue < 10 { allHighTrump = false }
            }
        }
        if anyBeater && allHighTrump && undef.count >= 2 {
            push(.take(player: player), -1_000)
            return out
        }
    }

    for target in undef {
        for card in legalTransfers(state, target: target) {
            push(.transfer(player: player, card: card, target: target),
                 transferHeuristic(card, state, player))
        }
        for card in legalDefenses(state, target: target) {
            push(.defend(player: player, card: card, target: target),
                 defendHeuristic(card, state.trumpSuit))
        }
    }

    if canTake(state, player) {
        let cheapestCover = out
            .filter { if case .defend = $0.move { return true }; return false }
            .map(\.heuristic)
            .min() ?? Int.max
        let takeBias: Int
        if cheapestCover == Int.max { takeBias = -50 }
        else if cheapestCover >= 110 { takeBias = 5 }
        else { takeBias = 80 }
        push(.take(player: player), takeBias)
    }

    // No legal beaters and no transfers → must take.
    if out.isEmpty && canTake(state, player) {
        push(.take(player: player), 0)
    }

    return out
}

private func generateAttackerCandidates(
    _ state: GameState, _ player: PlayerId, _ difficulty: AiDifficulty
) -> [ScoredMove] {
    let legal = legalAttacks(state, player)
    var out: [ScoredMove] = []
    var seen = Set<String>()

    func push(_ move: Move, _ heuristic: Int) {
        let key = moveKey(move)
        guard !seen.contains(key) else { return }
        seen.insert(key)
        out.append(ScoredMove(move: move, heuristic: heuristic))
    }

    // Opening attack.
    if state.table.isEmpty {
        if player != state.attackerId { return [] }
        let hand = handOf(state, player)
        for card in legal {
            push(.attack(player: player, card: card),
                 openingHeuristic(card, hand, state.trumpSuit))
        }
        return out
    }

    let defenderLow = handOf(state, state.defenderId).count <= 2
    let hand = handOf(state, player)

    for card in legal {
        let trump = isTrump(card, state.trumpSuit)
        let empties = hand.count == 1

        // Gate weak throw-ins by difficulty.
        if difficulty == .easy {
            if !state.takeInProgress && !(defenderLow && card.rank.rawValue <= 6 && !trump) {
                continue
            }
        } else if difficulty == .medium {
            if !state.takeInProgress && !defenderLow && !empties
                && (trump || card.rank.rawValue > 9) {
                continue
            }
        } else {
            // hard: allow most non-trump dumps; trump only on take / finish / low defender.
            if trump && !state.takeInProgress && !empties && !defenderLow {
                continue
            }
        }

        push(.attack(player: player, card: card),
             throwInHeuristic(card, state, player))
    }

    if canPass(state, player) {
        let bestThrow = out.map(\.heuristic).min() ?? Int.max
        let passH: Int
        if bestThrow == Int.max { passH = 0 }
        else if bestThrow > 12 { passH = -5 }
        else { passH = 25 }
        push(.pass(player: player), passH)
    }

    return out
}

private func generateCandidates(
    _ state: GameState, _ player: PlayerId, _ difficulty: AiDifficulty
) -> [ScoredMove] {
    guard state.phase == .playing else { return [] }

    // Empty primary attacker may still PASS after throwing their last card.
    if handOf(state, player).isEmpty {
        guard canPass(state, player) else { return [] }
        return [ScoredMove(move: .pass(player: player), heuristic: 0)]
    }

    let raw: [ScoredMove]
    if player == state.defenderId {
        raw = generateDefenderCandidates(state, player, difficulty)
    } else {
        raw = generateAttackerCandidates(state, player, difficulty)
    }

    let sorted = raw.sorted { $0.heuristic < $1.heuristic }
    let limit = maxCandidates[difficulty]!
    return Array(sorted.prefix(limit))
}

// MARK: - Search

/// Deterministic mix of state for easy's suboptimal picks.
private func stateHash(_ state: GameState, _ player: PlayerId) -> Int {
    var h = player.count * 17 + state.table.count * 31 + state.deck.count * 13
    for c in handOf(state, player) {
        h = (h &* 33) &+ c.rank.rawValue &* 7 &+ Int(c.suit.rawValue.first!.asciiValue!)
    }
    for pair in state.table {
        h = (h &* 19) &+ pair.attack.rank.rawValue
    }
    return abs(h)
}

/// Score a candidate by applying it and optionally looking ahead at replies.
private func scoreAfterMove(
    _ state: GameState, _ player: PlayerId, _ move: Move,
    depth: Int, difficulty: AiDifficulty
) -> Int {
    let next: GameState
    do {
        next = try applyMove(state, move)
    } catch {
        return Int.min
    }

    var immediate = 0

    // Opening leads: prefer low non-trumps with follow-up potential.
    if state.table.isEmpty, case .attack(_, let card) = move {
        return evaluatePosition(next, me: player)
            - openingHeuristic(card, handOf(state, player), state.trumpSuit) * 10
    }

    // While defender is taking, pile on cheap cards before passing.
    if state.takeInProgress {
        if case .attack(_, let card) = move {
            immediate += 70 - cardValue(card, state.trumpSuit) / 2
        } else if case .pass = move {
            immediate -= 35
        }
    }

    if depth <= 0 || next.phase == .gameOver {
        return evaluatePosition(next, me: player) + immediate
    }

    // Simulate one reply from the first other seat that can act.
    for opp in next.players {
        if opp == player { continue }
        let oppCandidates = generateCandidates(next, opp, difficulty)
        if oppCandidates.isEmpty { continue }

        // Opponent picks their best 1-ply evaluation (greedy reply).
        var bestOppScore = Int.min
        var bestOppMove = oppCandidates[0].move
        for sm in oppCandidates {
            guard let afterOpp = try? applyMove(next, sm.move) else { continue }
            let oppScore = evaluatePosition(afterOpp, me: opp)
            if oppScore > bestOppScore {
                bestOppScore = oppScore
                bestOppMove = sm.move
            }
        }

        guard let after = try? applyMove(next, bestOppMove) else {
            return evaluatePosition(next, me: player)
        }

        if depth <= 1 || after.phase == .gameOver {
            return evaluatePosition(after, me: player) + immediate
        }

        // One more ply: our best follow-up by static eval.
        var bestFollow = evaluatePosition(after, me: player)
        let followUps = generateCandidates(after, player, difficulty)
        for sm in followUps {
            if let end = try? applyMove(after, sm.move) {
                bestFollow = max(bestFollow, evaluatePosition(end, me: player))
            }
        }
        return bestFollow + immediate
    }

    // No opponent reply — still allow our own continuation.
    if depth >= 1 {
        let followUps = generateCandidates(next, player, difficulty)
        if !followUps.isEmpty {
            var bestFollow = evaluatePosition(next, me: player)
            for sm in followUps {
                if let end = try? applyMove(next, sm.move) {
                    bestFollow = max(bestFollow, evaluatePosition(end, me: player))
                }
            }
            return bestFollow + immediate
        }
    }

    return evaluatePosition(next, me: player) + immediate
}

// MARK: - Move Selection

private func selectMove(
    _ state: GameState, _ player: PlayerId,
    _ candidates: [ScoredMove], _ difficulty: AiDifficulty
) -> Move {
    let depth = searchDepth[difficulty]!

    struct RankedMove {
        let move: Move
        let heuristic: Int
        let score: Int
    }

    let ranked: [RankedMove] = candidates.map { c in
        let score: Int
        if depth == 0 {
            score = -c.heuristic
        } else {
            score = scoreAfterMove(state, player, c.move, depth: depth, difficulty: difficulty)
        }
        return RankedMove(move: c.move, heuristic: c.heuristic, score: score)
    }

    let sorted = ranked.sorted { a, b in
        if a.score != b.score { return a.score > b.score }
        return a.heuristic < b.heuristic
    }

    if difficulty == .easy && sorted.count > 1 {
        // Deterministically pick from the worse half so Easy stays beatable.
        let start = sorted.count / 2
        let idx = start + (stateHash(state, player) % (sorted.count - start))
        return sorted[idx].move
    }

    return sorted[0].move
}

// MARK: - Public API

/// Picks a move for an AI-controlled player, or returns nil when this player
/// currently has nothing to do (e.g. waiting on the defender).
public func pickMove(
    _ state: GameState, _ player: PlayerId,
    difficulty: AiDifficulty = .medium
) -> Move? {
    guard state.phase == .playing else { return nil }

    let candidates = generateCandidates(state, player, difficulty)
    if candidates.isEmpty { return nil }

    return selectMove(state, player, candidates, difficulty)
}

/// Convenience: the set of players an AI driver controls (everyone except humans).
public func aiSeats(_ state: GameState, humans: [PlayerId]) -> [PlayerId] {
    state.players.filter { !humans.contains($0) }
}
