import Foundation

/// A single reaction sticker (Noto Lottie token, or ad-hoc Unicode from peers).
struct ReactionSticker: Identifiable, Sendable, Hashable {
    /// Wire token: `n.*` for Noto, or raw Unicode from older / RN clients.
    let token: String
    let accessibilityLabel: String
    /// Lottie resource basename (no extension); nil for Unicode-only.
    let lottieName: String?
    /// Unicode stand-in for Reduce Motion, still frames, and peer fallbacks.
    let unicodeGlyph: String?

    var id: String { token }

    var kind: Kind {
        lottieName != nil ? .lottie : .unicode
    }

    enum Kind: Sendable {
        case unicode
        case lottie
    }
}

enum ReactionCatalog {
    static let maxTokenLength = 48

    /// All Noto reactions shown in the drawer.
    static var allNoto: [ReactionSticker] { noto }

    static var allLottieNames: [String] {
        noto.compactMap(\.lottieName)
    }

    static func sticker(for token: String) -> ReactionSticker? {
        if let hit = noto.first(where: { $0.token == token }) { return hit }
        // Ad-hoc Unicode from RN / older clients — show as text in burst.
        if !token.contains("."), token.count <= 8 {
            return ReactionSticker(
                token: token,
                accessibilityLabel: String(localized: "Reaction"),
                lottieName: nil,
                unicodeGlyph: token
            )
        }
        return nil
    }

    static func isValidWireToken(_ token: String) -> Bool {
        let t = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, t.count <= maxTokenLength else { return false }
        if t.range(of: #"^[zdn]\.[a-z0-9_]{1,32}$"#, options: .regularExpression) != nil {
            return true
        }
        return !t.contains(".") && t.count <= 8
    }

    // MARK: - Noto animated

    private static let notoIds: [(code: String, glyph: String, label: String)] = [
        ("1f600", "😀", "Grinning"),
        ("1f603", "😃", "Smiley"),
        ("1f604", "😄", "Smile eyes"),
        ("1f601", "😁", "Beaming"),
        ("1f605", "😅", "Sweat smile"),
        ("1f606", "😆", "Laughing"),
        ("1f602", "😂", "Tears of joy"),
        ("1f923", "🤣", "ROFL"),
        ("1f62d", "😭", "Loudly crying"),
        ("1f622", "😢", "Cry"),
        ("1f62e", "😮", "Open mouth"),
        ("1f62f", "😯", "Hushed"),
        ("1f609", "😉", "Wink"),
        ("1f60a", "😊", "Blush"),
        ("1f60d", "😍", "Heart eyes"),
        ("1f618", "😘", "Blow kiss"),
        ("1f61c", "😜", "Winking tongue"),
        ("1f92a", "🤪", "Zany"),
        ("1f60e", "😎", "Sunglasses"),
        ("1f929", "🤩", "Star struck"),
        ("1f917", "🤗", "Hugging"),
        ("1f914", "🤔", "Thinking"),
        ("1f634", "😴", "Sleeping"),
        ("1f971", "🥱", "Yawning"),
        ("1f97a", "🥺", "Pleading"),
        ("1f620", "😠", "Angry"),
        ("1f621", "😡", "Pouting"),
        ("1f92f", "🤯", "Exploding head"),
        ("1f921", "🤡", "Clown"),
        ("1f973", "🥳", "Partying"),
        ("1f44d", "👍", "Thumbs up"),
        ("1f44e", "👎", "Thumbs down"),
        ("1f44c", "👌", "OK hand"),
        ("1f44f", "👏", "Clapping"),
        ("1f64f", "🙏", "Folded hands"),
        ("1f4aa", "💪", "Flexed biceps"),
        ("1f525", "🔥", "Fire"),
        ("1f389", "🎉", "Party popper"),
        ("1f3c6", "🏆", "Trophy"),
        ("1f451", "👑", "Crown"),
        ("1f4af", "💯", "Hundred"),
        ("2b50", "⭐", "Star"),
        ("2764", "❤️", "Red heart"),
        ("1f494", "💔", "Broken heart"),
        ("23f0", "⏰", "Alarm clock"),
    ]

    private static let noto: [ReactionSticker] = notoIds.map { item in
        ReactionSticker(
            token: "n.\(item.code)",
            accessibilityLabel: item.label,
            lottieName: "noto_\(item.code)",
            unicodeGlyph: item.glyph
        )
    }
}
