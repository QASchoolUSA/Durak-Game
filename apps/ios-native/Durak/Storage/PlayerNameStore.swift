import Foundation

/// Manages the user's display name.
@Observable
final class PlayerNameStore {
    static let shared = PlayerNameStore()

    private enum Keys {
        static let playerName = "durak_player_name"
    }

    var name: String {
        didSet {
            UserDefaults.standard.set(name, forKey: Keys.playerName)
        }
    }

    private init() {
        if let stored = UserDefaults.standard.string(forKey: Keys.playerName), !stored.trimmingCharacters(in: .whitespaces).isEmpty {
            self.name = stored
        } else {
            self.name = "Player"
        }
    }
}
