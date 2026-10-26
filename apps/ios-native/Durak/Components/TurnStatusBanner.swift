import SwiftUI
import DurakGameCore

/// Floating banner showing whose turn it is and the current action prompt.
struct TurnStatusBanner: View {
    @Environment(ThemeManager.self) private var theme
    let game: GameState
    let humanId: String
    var names: [PlayerId: String] = [:]
    var isSubmittingOnlineMove: Bool = false
    var opponentReconnecting: Bool = false

    var statusText: String {
        if isSubmittingOnlineMove {
            return String(localized: "Sending move…")
        }

        if opponentReconnecting {
            return String(localized: "Opponent reconnecting…")
        }

        if game.phase == .gameOver {
            if game.loserId == humanId {
                return String(localized: "Game Over — You are the Durak!")
            } else if game.finishedOrder.contains(humanId) {
                return String(localized: "Victory! You won!")
            } else {
                return String(localized: "Game Over")
            }
        }

        if game.finishedOrder.contains(humanId) {
            return String(localized: "You're out — watching")
        }

        let isDefender = game.defenderId == humanId
        let undef = undefendedCount(game)
        let nameOf: (PlayerId) -> String = { id in
            names[id] ?? String(localized: "Opponent")
        }

        if game.takeInProgress {
            if isDefender {
                return String(localized: "Taking cards...")
            }
            if canThrowIn(game, humanId) {
                return String(localized: "Throw in more cards or wait")
            }
            return String(localized: "\(nameOf(game.defenderId)) is taking cards")
        }

        if undef > 0 {
            if isDefender {
                if undef == 1 {
                    return String(localized: "Your turn to defend — beat 1 card or take")
                }
                return String(localized: "Your turn to defend — beat \(undef) cards or take")
            }
            let defenderName = nameOf(game.defenderId)
            if undef == 1 {
                return String(localized: "Waiting for \(defenderName) to beat 1 card")
            }
            return String(localized: "Waiting for \(defenderName) to beat \(undef) cards")
        }

        // Empty table — primary attacker opens.
        if game.table.isEmpty {
            if game.attackerId == humanId {
                return String(localized: "Your turn to attack — play a card")
            }
            let attackerName = nameOf(game.attackerId)
            return String(localized: "Waiting for \(attackerName) to attack")
        }

        // Everything beaten — throw-in window before the bout ends.
        if canThrowIn(game, humanId) {
            return String(localized: "Throw in a matching card or press Done")
        }
        if isDefender {
            return String(localized: "Defended — waiting on throw-ins")
        }
        return String(localized: "Waiting for attackers to throw in or pass")
    }

    /// Accent when the human should act (attack, defend, or optional throw-in).
    var isMyTurn: Bool {
        if isSubmittingOnlineMove || opponentReconnecting { return false }
        guard game.phase == .playing else { return false }
        guard !game.finishedOrder.contains(humanId) else { return false }
        return humanMustAct(game, humanId)
    }

    private var isConfirming: Bool { isSubmittingOnlineMove }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Circle()
                .fill(
                    isConfirming
                        ? Color.orange
                        : (isMyTurn ? theme.ui.accent : DesignTokens.Colors.textMuted)
                )
                .frame(width: 8, height: 8)

            Text(statusText)
                .font(DesignTokens.Typography.caption)
                .fontWeight(.semibold)
                .foregroundStyle(
                    isConfirming || isMyTurn
                        ? DesignTokens.Colors.textLight
                        : DesignTokens.Colors.textMuted
                )
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, DesignTokens.Spacing.sm)
        .padding(.vertical, DesignTokens.Spacing.xs)
        .background(
            Capsule()
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    Capsule()
                        .stroke(
                            isConfirming
                                ? Color.orange.opacity(0.7)
                                : (isMyTurn ? theme.ui.accent.opacity(0.6) : Color.white.opacity(0.1)),
                            lineWidth: 1
                        )
                )
        )
        .animation(.easeInOut(duration: 0.25), value: statusText)
    }
}
