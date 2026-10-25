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

    func navigate(to screen: Screen) {
        current = screen
    }
}
