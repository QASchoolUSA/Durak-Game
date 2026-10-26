import SwiftUI

/// App-wide navigation state.
@Observable
final class AppRouter {
    enum Screen: Sendable {
        case boot
        case welcome
        case home
        case lobby
        case game
        case result
    }

    var current: Screen = .boot
    var settingsPresented = false
    var rulesPresented = false
    /// Opens the join sheet from Home (fallback when auto-join cannot run).
    var joinSheetPresented = false
    /// Prefill for JoinGameSheet when opened via deep link or clipboard.
    var pendingJoinCode: String? = nil
    /// Invite code waiting for auto-join once auth/onboarding is ready.
    var pendingInviteCode: String? = nil
    /// True while auto-joining an invite link.
    var isJoiningInvite = false

    func navigate(to screen: Screen) {
        current = screen
    }

    /// Stores an invite room code from a Universal Link / custom scheme URL.
    @MainActor
    func handleInviteURL(_ url: URL) {
        guard let code = InviteLinks.roomCode(from: url) else { return }
        // Don't interrupt an active match mid-hand.
        if current == .game { return }
        pendingInviteCode = code
        pendingJoinCode = code
    }
}
