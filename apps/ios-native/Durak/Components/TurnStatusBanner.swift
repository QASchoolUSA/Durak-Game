import SwiftUI
import DurakGameCore

/// Floating banner showing whose turn it is and the current action prompt.
struct TurnStatusBanner: View {
    @Environment(ThemeManager.self) private var theme
    let game: GameState
    let humanId: String

    var statusText: String {
        if game.phase == .gameOver {
            if game.loserId == humanId {
                return "Game Over — You are the Durak!"
            } else if game.finishedOrder.contains(humanId) {
                return "Victory! You won!"
            } else {
                return "Game Over"
            }
        }

        if game.finishedOrder.contains(humanId) {
            return "You're out — watching"
        }

        if game.takeInProgress {
            let remainingAttackers = game.players.filter { p in
                p != game.defenderId && !(game.hands[p] ?? []).isEmpty
            }
            if remainingAttackers.isEmpty {
                return "Resolving take..."
            }
            if game.defenderId == humanId {
                return "Taking cards..."
            } else {
                return "Opponent is taking cards — throw in!"
            }
        }

        if game.table.isEmpty {
            if game.attackerId == humanId {
                return "Your turn to attack — play a card"
            } else {
                return "Waiting for attack..."
            }
        } else {
            if game.defenderId == humanId {
                return "Your turn to defend — beat all cards or take"
            } else {
                return "Waiting for defense..."
            }
        }
    }

    var isMyTurn: Bool {
        game.phase == .playing
            && !game.finishedOrder.contains(humanId)
            && (game.attackerId == humanId || game.defenderId == humanId)
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Circle()
                .fill(isMyTurn ? theme.ui.accent : DesignTokens.Colors.textMuted)
                .frame(width: 8, height: 8)

            Text(statusText)
                .font(DesignTokens.Typography.caption)
                .fontWeight(.semibold)
                .foregroundStyle(isMyTurn ? DesignTokens.Colors.textLight : DesignTokens.Colors.textMuted)
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.xs)
        .background(
            Capsule()
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    Capsule()
                        .stroke(isMyTurn ? theme.ui.accent.opacity(0.6) : Color.white.opacity(0.1), lineWidth: 1)
                )
        )
        .animation(.easeInOut(duration: 0.25), value: statusText)
    }
}
