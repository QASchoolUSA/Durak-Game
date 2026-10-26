/// Match economy — buy-in and pot calculation.
///
/// 1:1 port of `packages/game-core/src/matchEconomy.ts`.

/// Match credit buy-in (regular coins).
public let matchBuyIn = 100

public func matchPot(numPlayers: Int, buyIn: Int = matchBuyIn) -> Int {
    let n = max(0, numPlayers)
    return buyIn * n
}

/// Credits awarded to the human at solo match end (0 if loser; buy-in already paid).
/// Port of `apps/mobile/src/game/matchSettlement.ts` `soloMatchEndCreditDelta`.
public func soloMatchEndCreditDelta(
    isDraw: Bool,
    humanIsWinner: Bool,
    numPlayers: Int,
    buyIn: Int = matchBuyIn
) -> Int {
    if isDraw { return buyIn }
    if humanIsWinner { return matchPot(numPlayers: numPlayers, buyIn: buyIn) }
    return 0
}
