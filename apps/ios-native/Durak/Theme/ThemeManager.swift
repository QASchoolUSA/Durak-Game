import SwiftUI

/// Observable theme manager — provides the active appearance to both SwiftUI and SpriteKit.
@Observable
final class ThemeManager {
    var activeAppearanceId: AppearanceId = .green {
        didSet {
            UserDefaults.standard.set(activeAppearanceId.rawValue, forKey: "appearance")
        }
    }

    var activeAppearance: AppearancePreset {
        getAppearance(activeAppearanceId)
    }

    var activePreset: AppearancePreset {
        activeAppearance
    }

    var tablePalette: TablePalette {
        activeAppearance.table
    }

    var cardPalette: CardPalette {
        activeAppearance.card
    }

    var ui: UiPalette {
        activeAppearance.ui
    }

    init() {
        if let stored = UserDefaults.standard.string(forKey: "appearance"),
           let id = AppearanceId(rawValue: stored) {
            self.activeAppearanceId = id
        }
    }
}
