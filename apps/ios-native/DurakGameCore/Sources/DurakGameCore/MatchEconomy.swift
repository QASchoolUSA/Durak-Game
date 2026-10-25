/// Match economy — buy-in and pot calculation.
///
/// 1:1 port of `packages/game-core/src/matchEconomy.ts`.

/// Match credit buy-in (regular coins).
public let matchBuyIn = 100

public func matchPot(numPlayers: Int, buyIn: Int = matchBuyIn) -> Int {
    let n = max(0, numPlayers)
    return buyIn * n
}
