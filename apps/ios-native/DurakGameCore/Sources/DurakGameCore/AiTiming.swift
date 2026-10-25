/// AI move delay timing.
///
/// 1:1 port of `packages/game-core/src/aiTiming.ts`.

/// Pause before each bot move (milliseconds).
public let aiDelayMs: [AiDifficulty: Int] = [
    .easy: 3000,
    .medium: 2500,
    .hard: 2000,
]

public let minAiDelayMs = 2000

public func aiMoveDelay(_ difficulty: AiDifficulty) -> Int {
    max(aiDelayMs[difficulty]!, minAiDelayMs)
}

/// AI move delay as a `Duration` for use with `Task.sleep`.
public func aiMoveDelayDuration(_ difficulty: AiDifficulty) -> Duration {
    .milliseconds(aiMoveDelay(difficulty))
}
