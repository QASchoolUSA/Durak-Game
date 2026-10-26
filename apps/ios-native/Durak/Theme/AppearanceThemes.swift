import SwiftUI

/// Curated 5 appearance presets for table and card theming:
/// Emerald Table, Royal Velvet, Sapphire Room, Twilight Room, and Steel Navy.

// MARK: - Card Back Patterns

enum CardBackPattern: String, Codable, Sendable {
    case crest, seal, weave, sunburst
}

// MARK: - Palettes

struct CardPalette: Sendable {
    let face: Color
    let faceEdge: Color
    let back: Color
    let backLight: Color
    let backAccent: Color
    let suitRed: Color
    let suitBlack: Color
    let backPattern: CardBackPattern
}

struct TablePalette: Sendable {
    let backgroundColor: Color
    let gradient: [Color]?
}

/// Dynamic UI Palette for full-screen theme harmonization across cards, buttons, selection bezels, and badges.
struct UiPalette: Sendable {
    /// The primary signature accent color of the theme (replaces hardcoded gold).
    let accent: Color
    /// Two harmonious gradient colors for hero buttons, active bezels, and glowing text headers.
    let accentGradient: [Color]
    /// High-contrast text color for elements rendered on top of `accentGradient`.
    let accentText: Color
    /// Translucent accent color (`~18-20%`) for subtle borders, icon circles, and halos.
    let accentSoft: Color
    /// Muted accent color for secondary text, small labels, and subtle icons.
    let accentMuted: Color
    /// Frosted glass card background tinted with the theme's felt tone (replaces pitch-black).
    let surfaceGlass: Color
    /// Deeper card background tinted with the theme for troughs and secondary layers.
    let surfaceCard: Color
    /// Hairline card border matching the theme.
    let surfaceBorder: Color
    /// Highlighted border for active/focused elements.
    let surfaceBorderHighlighted: Color
    /// Fill color for selected/active pills and controls.
    let selectionBg: Color
    /// Border color for selected/active pills and controls.
    let selectionBorder: Color
    /// Badge pill background (Host, Ready, Difficulty).
    let badgeBg: Color
    /// High-contrast text color inside badges.
    let badgeText: Color
}

// MARK: - Appearance ID

enum AppearanceId: String, CaseIterable, Codable, Sendable {
    case green, purple, blue, indigo, navy
}

// MARK: - Preset

struct AppearancePreset: Sendable {
    let id: AppearanceId
    let name: String
    let tagline: String
    let table: TablePalette
    let card: CardPalette
    let ui: UiPalette
}

// MARK: - Preset Definitions

let appearancePresets: [AppearanceId: AppearancePreset] = [
    .green: AppearancePreset(
        id: .green, name: "Emerald Table", tagline: "Brand felt, mint crest backs",
        table: TablePalette(backgroundColor: Color(hex: "#14724F"), gradient: [Color(hex: "#14724F"), Color(hex: "#092E1F")]),
        card: CardPalette(face: Color(hex: "#FAF7F0"), faceEdge: Color(hex: "#DDD6C5"),
                          back: Color(hex: "#0E3D2C"), backLight: Color(hex: "#145238"),
                          backAccent: Color(hex: "#6BCF9A"), suitRed: Color(hex: "#C62828"),
                          suitBlack: Color(hex: "#1A2E24"), backPattern: .crest),
        ui: UiPalette(
            accent: Color(hex: "#E7C067"),
            accentGradient: [Color(hex: "#E7C067"), Color(hex: "#F5D27A")],
            accentText: Color(hex: "#1B1B1F"),
            accentSoft: Color(hex: "#E7C067").opacity(0.18),
            accentMuted: Color(hex: "#C49E4A"),
            surfaceGlass: Color(hex: "#092E1F").opacity(0.52),
            surfaceCard: Color(hex: "#062217").opacity(0.78),
            surfaceBorder: Color(hex: "#E7C067").opacity(0.22),
            surfaceBorderHighlighted: Color(hex: "#E7C067").opacity(0.55),
            selectionBg: Color(hex: "#E7C067"),
            selectionBorder: Color(hex: "#F5D27A"),
            badgeBg: Color(hex: "#E7C067"),
            badgeText: Color(hex: "#1B1B1F")
        )
    ),
    .purple: AppearancePreset(
        id: .purple, name: "Royal Velvet", tagline: "Deep purple felt, royal seal backs",
        table: TablePalette(backgroundColor: Color(hex: "#6B3FA0"), gradient: [Color(hex: "#6B3FA0"), Color(hex: "#2D1B4E")]),
        card: CardPalette(face: Color(hex: "#F6F2FA"), faceEdge: Color(hex: "#D8CCE8"),
                          back: Color(hex: "#3D2463"), backLight: Color(hex: "#4A2E75"),
                          backAccent: Color(hex: "#C4B5FD"), suitRed: Color(hex: "#C62828"),
                          suitBlack: Color(hex: "#1A2E24"), backPattern: .seal),
        ui: UiPalette(
            accent: Color(hex: "#C084FC"),
            accentGradient: [Color(hex: "#C084FC"), Color(hex: "#E9D5FF")],
            accentText: Color(hex: "#1E0A3C"),
            accentSoft: Color(hex: "#C084FC").opacity(0.20),
            accentMuted: Color(hex: "#A855F7"),
            surfaceGlass: Color(hex: "#24123E").opacity(0.55),
            surfaceCard: Color(hex: "#1A0C2E").opacity(0.80),
            surfaceBorder: Color(hex: "#C084FC").opacity(0.24),
            surfaceBorderHighlighted: Color(hex: "#C084FC").opacity(0.60),
            selectionBg: Color(hex: "#C084FC"),
            selectionBorder: Color(hex: "#E9D5FF"),
            badgeBg: Color(hex: "#C084FC"),
            badgeText: Color(hex: "#1E0A3C")
        )
    ),
    .blue: AppearancePreset(
        id: .blue, name: "Sapphire Room", tagline: "Casino blue felt, woven lattice backs",
        table: TablePalette(backgroundColor: Color(hex: "#2563A8"), gradient: [Color(hex: "#2563A8"), Color(hex: "#0F2847")]),
        card: CardPalette(face: Color(hex: "#F5F8FC"), faceEdge: Color(hex: "#C8D8E8"),
                          back: Color(hex: "#15324A"), backLight: Color(hex: "#1A3D5C"),
                          backAccent: Color(hex: "#7CB8E8"), suitRed: Color(hex: "#D7263D"),
                          suitBlack: Color(hex: "#20232A"), backPattern: .weave),
        ui: UiPalette(
            accent: Color(hex: "#38BDF8"),
            accentGradient: [Color(hex: "#38BDF8"), Color(hex: "#93C5FD")],
            accentText: Color(hex: "#08203E"),
            accentSoft: Color(hex: "#38BDF8").opacity(0.20),
            accentMuted: Color(hex: "#60A5FA"),
            surfaceGlass: Color(hex: "#0D223B").opacity(0.55),
            surfaceCard: Color(hex: "#07172A").opacity(0.80),
            surfaceBorder: Color(hex: "#38BDF8").opacity(0.24),
            surfaceBorderHighlighted: Color(hex: "#38BDF8").opacity(0.60),
            selectionBg: Color(hex: "#38BDF8"),
            selectionBorder: Color(hex: "#93C5FD"),
            badgeBg: Color(hex: "#38BDF8"),
            badgeText: Color(hex: "#08203E")
        )
    ),
    .indigo: AppearancePreset(
        id: .indigo, name: "Twilight Room", tagline: "Midnight indigo felt, steel weave backs",
        table: TablePalette(backgroundColor: Color(hex: "#22273D"), gradient: [Color(hex: "#22273D"), Color(hex: "#111420")]),
        card: CardPalette(face: Color(hex: "#F2F4FB"), faceEdge: Color(hex: "#C2CADF"),
                          back: Color(hex: "#2C3352"), backLight: Color(hex: "#384169"),
                          backAccent: Color(hex: "#808EC4"), suitRed: Color(hex: "#C62828"),
                          suitBlack: Color(hex: "#151822"), backPattern: .weave),
        ui: UiPalette(
            accent: Color(hex: "#A5B4FC"),
            accentGradient: [Color(hex: "#818CF8"), Color(hex: "#E0E7FF")],
            accentText: Color(hex: "#1E1B4B"),
            accentSoft: Color(hex: "#A5B4FC").opacity(0.20),
            accentMuted: Color(hex: "#6366F1"),
            surfaceGlass: Color(hex: "#171B30").opacity(0.55),
            surfaceCard: Color(hex: "#0E1120").opacity(0.80),
            surfaceBorder: Color(hex: "#A5B4FC").opacity(0.22),
            surfaceBorderHighlighted: Color(hex: "#A5B4FC").opacity(0.60),
            selectionBg: Color(hex: "#A5B4FC"),
            selectionBorder: Color(hex: "#E0E7FF"),
            badgeBg: Color(hex: "#A5B4FC"),
            badgeText: Color(hex: "#1E1B4B")
        )
    ),
    .navy: AppearancePreset(
        id: .navy, name: "Steel Navy", tagline: "Muted steel blue felt, slate wave backs",
        table: TablePalette(backgroundColor: Color(hex: "#243642"), gradient: [Color(hex: "#243642"), Color(hex: "#141E26")]),
        card: CardPalette(face: Color(hex: "#F4F7F9"), faceEdge: Color(hex: "#C8D4DD"),
                          back: Color(hex: "#2C3E4C"), backLight: Color(hex: "#384C5C"),
                          backAccent: Color(hex: "#7F9CB5"), suitRed: Color(hex: "#C62828"),
                          suitBlack: Color(hex: "#171D22"), backPattern: .seal),
        ui: UiPalette(
            accent: Color(hex: "#7DD3FC"),
            accentGradient: [Color(hex: "#38BDF8"), Color(hex: "#BAE6FD")],
            accentText: Color(hex: "#082F49"),
            accentSoft: Color(hex: "#7DD3FC").opacity(0.20),
            accentMuted: Color(hex: "#38BDF8"),
            surfaceGlass: Color(hex: "#14202B").opacity(0.55),
            surfaceCard: Color(hex: "#0D161E").opacity(0.80),
            surfaceBorder: Color(hex: "#7DD3FC").opacity(0.22),
            surfaceBorderHighlighted: Color(hex: "#7DD3FC").opacity(0.60),
            selectionBg: Color(hex: "#7DD3FC"),
            selectionBorder: Color(hex: "#BAE6FD"),
            badgeBg: Color(hex: "#7DD3FC"),
            badgeText: Color(hex: "#082F49")
        )
    ),
]

/// Ordered list for the appearance picker UI.
let appearanceOrder: [AppearanceId] = [
    .green, .purple, .blue, .indigo, .navy,
]

let defaultAppearance: AppearanceId = .green

func getAppearance(_ id: AppearanceId) -> AppearancePreset {
    appearancePresets[id] ?? appearancePresets[.green]!
}

enum AppearanceThemes {
    static let all: [AppearancePreset] = appearanceOrder.map { getAppearance($0) }
}
