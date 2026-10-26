import Foundation
import SwiftUI

/// Observable store managing Gold coins and Credit balances.
@Observable
final class EconomyStore {
    static let shared = EconomyStore()

    static let startingGold = 10
    /// Align with server `STARTING_CREDITS` in `goldEconomy.ts`.
    static let startingCredits = 1000
    static let winGoldReward = 10
    static let matchBuyIn = 100

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

    /// Spends gold locally, and mirrors to Convex when a wallet session exists.
    /// Returns false if the local balance cannot cover the cost (or server rejects).
    @MainActor
    func spendGoldSynced(_ amount: Int, reason: String) async -> Bool {
        guard amount > 0 else { return true }
        guard canAffordGold(amount) else { return false }

        if ConvexAuth.shared.hasWalletSession {
            // Optimistic local deduct; roll back if the server rejects.
            gold = max(0, gold - amount)
            do {
                _ = try await ConvexAuth.shared.spendGold(amount: amount, reason: reason)
                return true
            } catch {
                gold += amount
                return false
            }
        }

        return spendGold(amount)
    }

    func rewardWin() {
        gold += EconomyStore.winGoldReward
    }

    func canAffordCredits(_ amount: Int) -> Bool {
        amount <= 0 || credits >= amount
    }

    /// Deducts credits for match buy-in. Returns false if insufficient.
    @discardableResult
    func deductCredits(_ amount: Int) -> Bool {
        guard canAffordCredits(amount) else { return false }
        credits = max(0, credits - amount)
        return true
    }

    func adjustCredits(_ delta: Int) {
        credits = max(0, credits + delta)
    }

    /// Apply server wallet balances (signed-in source of truth).
    func syncFromServer(gold: Int?, credits: Int?) {
        if let gold {
            self.gold = max(0, gold)
        }
        if let credits {
            self.credits = max(0, credits)
        }
    }

    /// Resets local balances to defaults (used on logout / account switch).
    func resetToStartingBalances() {
        gold = EconomyStore.startingGold
        credits = EconomyStore.startingCredits
    }
}
