/// Timeout / auto-play move logic when a human runs out of turn time.
///
/// 1:1 port of `packages/game-core/src/timeoutMove.ts`.

/// Move played when a human runs out of turn time:
/// TAKE (defender) → PASS (attacker) → lowest opening ATTACK → nil.
/// Optional throw-ins are never auto-played.
public func timeoutMoveFor(_ state: GameState, _ player: PlayerId) -> Move? {
    guard state.phase == .playing else { return nil }

    if canTake(state, player) {
        return .take(player: player)
    }

    if canPass(state, player) {
        return .pass(player: player)
    }

    if player == state.attackerId && state.table.isEmpty {
        let legal = legalAttacks(state, player)
        if !legal.isEmpty {
            let card = legal.sorted { $0.rank < $1.rank }[0]
            return .attack(player: player, card: card)
        }
    }

    return nil
}

// MARK: - Forced / Optional Action Detection

private func hasLegalDefense(_ state: GameState, _ player: PlayerId) -> Bool {
    guard state.defenderId == player, !state.takeInProgress else { return false }
    for target in undefendedPairs(state) {
        if !legalDefenses(state, target: target).isEmpty { return true }
    }
    return false
}

private func canOptionalThrowIn(_ state: GameState, _ player: PlayerId) -> Bool {
    guard player != state.defenderId else { return false }
    guard !state.table.isEmpty else { return false }
    return !legalAttacks(state, player).isEmpty
}

/// True when the player has a forced action the turn clock should resolve
/// (take / pass / transfer / open attack / defend). Optional throw-in is excluded.
public func humanForcedAct(_ state: GameState, _ player: PlayerId) -> Bool {
    guard state.phase == .playing else { return false }

    let isDefender = state.defenderId == player
    let attackable = legalAttacks(state, player)
    let mustOpen = !isDefender && state.table.isEmpty && !attackable.isEmpty

    return canTake(state, player)
        || canPass(state, player)
        || canTransfer(state, player)
        || mustOpen
        || hasLegalDefense(state, player)
}

/// True when a human has any legal action, including optional throw-in.
public func humanMustAct(_ state: GameState, _ player: PlayerId) -> Bool {
    guard state.phase == .playing else { return false }
    return humanForcedAct(state, player) || canOptionalThrowIn(state, player)
}

public struct ActiveHumanOptions: Sendable {
    /// When true, ignore optional throw-in seats (used after a null timeout).
    public var forcedOnly: Bool

    public init(forcedOnly: Bool = false) {
        self.forcedOnly = forcedOnly
    }
}

/// Human who should own the turn clock. Prefers forced actors so optional
/// throw-in never blocks a defender who can auto-TAKE on timeout.
public func activeHumanPlayer(
    _ state: GameState,
    bots: Set<String>,
    options: ActiveHumanOptions = ActiveHumanOptions()
) -> PlayerId? {
    func eligible(_ p: PlayerId) -> Bool {
        !bots.contains(p) && !state.finishedOrder.contains(p)
    }

    for p in state.players {
        guard eligible(p) else { continue }
        if humanForcedAct(state, p) { return p }
    }

    if options.forcedOnly { return nil }

    for p in state.players {
        guard eligible(p) else { continue }
        if canOptionalThrowIn(state, p) { return p }
    }

    return nil
}
