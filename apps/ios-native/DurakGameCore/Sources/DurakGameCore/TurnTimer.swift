/// Turn timer constants and normalization.
///
/// 1:1 port of `packages/game-core/src/turnTimer.ts`.

/// Allowed turn-timer durations (seconds per turn).
public let validTurnSeconds: [Int] = [10, 12, 15, 30]

public let defaultTurnSeconds: Int = 12

/// Coerce stored or server values to a valid option (legacy 0/60 → default).
public func normalizeTurnSeconds(_ raw: Int?) -> Int {
    if let raw, validTurnSeconds.contains(raw) {
        return raw
    }
    return defaultTurnSeconds
}
