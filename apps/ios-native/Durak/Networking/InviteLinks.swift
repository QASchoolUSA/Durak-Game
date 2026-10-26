import Foundation
import UIKit

/// Canonical invite URLs for Universal Links on durak.cards.
///
/// Custom scheme is `duraknative://` (Swift app only). Expo owns `durak://` —
/// never use that scheme here or the web “Open in Durak” button will launch RN.
enum InviteLinks {
    static let host = "durak.cards"
    static let joinPathPrefix = "/join/"
    /// Swift-native custom URL scheme (must not collide with Expo `durak`).
    static let nativeScheme = "duraknative"

    static func joinURL(code: String) -> URL {
        let clean = normalizeRoomCode(code)
        return URL(string: "https://\(host)\(joinPathPrefix)\(clean)")!
    }

    static func nativeJoinURL(code: String) -> URL {
        let clean = normalizeRoomCode(code)
        return URL(string: "\(nativeScheme)://join/\(clean)")!
    }

    /// Body text for ShareLink. Do **not** include the URL here — `ShareLink(item:)`
    /// already attaches it once; duplicating it shows two links in Messages.
    static func shareMessage(code: String) -> String {
        let clean = normalizeRoomCode(code)
        return "Join my Durak game! Code \(clean)"
    }

    /// Extracts a room code from `https://durak.cards/join/CODE` or `duraknative://join/CODE`.
    static func roomCode(from url: URL) -> String? {
        let host = (url.host ?? "").lowercased()
        let scheme = (url.scheme ?? "").lowercased()

        let isUniversal = scheme == "https" || scheme == "http"
        let isCustom = scheme == nativeScheme

        guard (isUniversal && (host == Self.host || host == "www.\(Self.host)")) || isCustom else {
            return nil
        }

        var parts = url.path.split(separator: "/").map(String.init)
        if parts.first?.lowercased() == "join" {
            parts.removeFirst()
        } else if host == "join", let code = parts.first {
            // duraknative://join/CODE → host "join", path "/CODE"
            return normalizeRoomCode(code)
        } else {
            return nil
        }

        guard let raw = parts.first, !raw.isEmpty else { return nil }
        let code = normalizeRoomCode(raw)
        return isPlausibleRoomCode(code) ? code : nil
    }

    static func normalizeRoomCode(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    }

    /// Room codes are 6-digit numbers from the server; also accept short alphanumerics for paste assist.
    static func isPlausibleRoomCode(_ code: String) -> Bool {
        let trimmed = normalizeRoomCode(code)
        if trimmed.range(of: #"^\d{6}$"#, options: .regularExpression) != nil {
            return true
        }
        return trimmed.range(of: #"^[A-Z0-9]{4,8}$"#, options: .regularExpression) != nil
    }

    /// Best-effort room code from the general pasteboard (nil if nothing plausible).
    static func roomCodeFromPasteboard() -> String? {
        guard let raw = UIPasteboard.general.string else { return nil }
        let trimmed = normalizeRoomCode(raw)
        if isPlausibleRoomCode(trimmed) {
            return trimmed
        }
        if let url = URL(string: trimmed), let code = roomCode(from: url) {
            return code
        }
        if let match = trimmed.range(of: #"\b\d{6}\b"#, options: .regularExpression) {
            return String(trimmed[match])
        }
        if let urlRange = trimmed.range(
            of: #"https?://(?:www\.)?durak\.cards/join/[A-Z0-9]+"#,
            options: [.regularExpression, .caseInsensitive]
        ) {
            if let url = URL(string: String(trimmed[urlRange])), let code = roomCode(from: url) {
                return code
            }
        }
        return nil
    }
}
