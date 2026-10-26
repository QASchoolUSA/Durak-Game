import Foundation

/// User-facing copy for online lobby join/create failures (never raw Convex stacks).
enum OnlineErrorCopy {
    struct Notice: Equatable {
        let title: String
        let detail: String
    }

    static func joinNotice(for error: Error) -> Notice {
        notice(for: error, fallbackTitle: String(localized: "Couldn’t join"))
    }

    static func createNotice(for error: Error) -> Notice {
        notice(for: error, fallbackTitle: String(localized: "Couldn’t create room"))
    }

    private static func notice(for error: Error, fallbackTitle: String) -> Notice {
        let raw = error.localizedDescription
        let lowered = raw.lowercased()

        if lowered.contains("finish or leave") || lowered.contains("current match") {
            return Notice(
                title: String(localized: "Still in another match"),
                detail: String(localized: "Leave or finish your other table, then try again.")
            )
        }
        if lowered.contains("room not found") || lowered.contains("already started") {
            return Notice(
                title: String(localized: "Room unavailable"),
                detail: String(localized: "That code isn’t open to join right now.")
            )
        }
        if lowered.contains("room is full") {
            return Notice(
                title: String(localized: "Table is full"),
                detail: String(localized: "Ask the host to free a seat or start a new room.")
            )
        }
        if lowered.contains("need at least") || lowered.contains("waiting for another") {
            return Notice(
                title: String(localized: "Need another player"),
                detail: String(localized: "Invite a friend or add an AI seat to begin.")
            )
        }

        return Notice(title: fallbackTitle, detail: strippedDetail(raw))
    }

    /// Strips Convex Request IDs, “Server Error”, and stack frames.
    static func strippedDetail(_ message: String) -> String {
        var text = message
        if let range = text.range(of: "Uncaught Error:", options: .caseInsensitive) {
            text = String(text[range.upperBound...])
        } else if let range = text.range(of: "Convex Error:", options: .caseInsensitive) {
            text = String(text[range.upperBound...])
        }
        if let range = text.range(of: "\nat ") {
            text = String(text[..<range.lowerBound])
        }
        if let range = text.range(of: " at handler") {
            text = String(text[..<range.lowerBound])
        }
        while let start = text.range(of: "[Request ID:"),
              let end = text[start.lowerBound...].range(of: "]") {
            text.removeSubrange(start.lowerBound..<end.upperBound)
        }
        text = text
            .replacingOccurrences(of: "Server Error", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty {
            return String(localized: "Please try again in a moment.")
        }
        if text.count > 80 {
            return String(text.prefix(77)) + "…"
        }
        return text
    }
}
