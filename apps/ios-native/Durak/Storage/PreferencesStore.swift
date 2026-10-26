import Foundation
import SwiftUI

/// Observable store managing user preferences with UserDefaults backing.
@MainActor
@Observable
final class PreferencesStore {
    static let shared = PreferencesStore()

    private enum Keys {
        static let soundEnabled = "durak_sound_enabled"
        static let hapticsEnabled = "durak_haptics_enabled"
        static let turnSeconds = "durak_turn_seconds"
        static let tutorialCompleted = "durak_tutorial_completed"
        static let language = "durak_language"
        static let appearance = "durak_appearance"
        /// Legacy key — cleared on launch (packs removed).
        static let selectedReactionPack = "durak_reaction_pack"
    }

    var soundEnabled: Bool {
        didSet {
            UserDefaults.standard.set(soundEnabled, forKey: Keys.soundEnabled)
            FeedbackManager.shared.soundEnabled = soundEnabled
        }
    }

    var hapticsEnabled: Bool {
        didSet {
            UserDefaults.standard.set(hapticsEnabled, forKey: Keys.hapticsEnabled)
            FeedbackManager.shared.hapticsEnabled = hapticsEnabled
        }
    }

    var turnSeconds: Int {
        didSet {
            UserDefaults.standard.set(turnSeconds, forKey: Keys.turnSeconds)
        }
    }

    var tutorialCompleted: Bool {
        didSet {
            UserDefaults.standard.set(tutorialCompleted, forKey: Keys.tutorialCompleted)
        }
    }

    var language: String {
        didSet {
            UserDefaults.standard.set(language, forKey: Keys.language)
        }
    }

    private init() {
        let defaults = UserDefaults.standard

        if defaults.object(forKey: Keys.soundEnabled) != nil {
            self.soundEnabled = defaults.bool(forKey: Keys.soundEnabled)
        } else {
            self.soundEnabled = true
        }

        if defaults.object(forKey: Keys.hapticsEnabled) != nil {
            self.hapticsEnabled = defaults.bool(forKey: Keys.hapticsEnabled)
        } else {
            self.hapticsEnabled = true
        }

        let seconds = defaults.integer(forKey: Keys.turnSeconds)
        self.turnSeconds = seconds > 0 ? seconds : 30

        self.tutorialCompleted = defaults.bool(forKey: Keys.tutorialCompleted)
        self.language = defaults.string(forKey: Keys.language) ?? "system"

        defaults.removeObject(forKey: Keys.selectedReactionPack)

        FeedbackManager.shared.soundEnabled = self.soundEnabled
        FeedbackManager.shared.hapticsEnabled = self.hapticsEnabled
    }
}
