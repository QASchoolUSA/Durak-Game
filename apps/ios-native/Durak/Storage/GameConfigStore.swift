import Foundation
import DurakGameCore

/// Manages persisted game configuration for solo and online match setups.
@Observable
final class GameConfigStore {
    static let shared = GameConfigStore()

    private enum Keys {
        static let config = "durak_game_config"
    }

    struct StoredConfig: Codable, Equatable, Sendable {
        var numPlayers: Int
        var variant: GameVariant
        var throwInScope: ThrowInScope
        var playStyle: PlayStyle
        var difficulty: AiDifficulty

        static let `default` = StoredConfig(
            numPlayers: 2,
            variant: .podkidnoy,
            throwInScope: .all,
            playStyle: .standard,
            difficulty: .medium
        )
    }

    var config: StoredConfig {
        didSet {
            if let data = try? JSONEncoder().encode(config) {
                UserDefaults.standard.set(data, forKey: Keys.config)
            }
        }
    }

    private init() {
        if let data = UserDefaults.standard.data(forKey: Keys.config),
           let saved = try? JSONDecoder().decode(StoredConfig.self, from: data) {
            self.config = saved
        } else {
            self.config = .default
        }
    }
}
