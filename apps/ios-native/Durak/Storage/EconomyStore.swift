import Foundation
import SwiftUI

/// Observable store managing Gold coins and Credit balances.
@Observable
final class EconomyStore {
    static let shared = EconomyStore()

    static let startingGold = 10
    static let startingCredits = 100
    static let winGoldReward = 10

    static let returnGoldCost = 0
    static let revealGoldCost = 2
    static let graveyardGoldCost = 1
    static let hintGoldCost = 1

    private enum Keys {
        static let goldBalance = "durak_gold_balance"
        static let creditBalance = "durak_credit_balance"
    }

    var gold: Int {
        didSet {
            UserDefaults.standard.set(gold, forKey: Keys.goldBalance)
        }
    }

    var credits: Int {
        didSet {
            UserDefaults.standard.set(credits, forKey: Keys.creditBalance)
        }
    }

    private init() {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: Keys.goldBalance) != nil {
            self.gold = defaults.integer(forKey: Keys.goldBalance)
        } else {
            self.gold = EconomyStore.startingGold
        }

        if defaults.object(forKey: Keys.creditBalance) != nil {
            self.credits = defaults.integer(forKey: Keys.creditBalance)
        } else {
            self.credits = EconomyStore.startingCredits
        }
    }

    func canAffordGold(_ cost: Int) -> Bool {
        return cost <= 0 || gold >= cost
    }

    func spendGold(_ amount: Int) -> Bool {
        guard canAffordGold(amount) else { return false }
        gold = max(0, gold - amount)
        return true
    }

    func rewardWin() {
        gold += EconomyStore.winGoldReward
    }

    func adjustCredits(_ delta: Int) {
        credits = max(0, credits + delta)
    }
}
