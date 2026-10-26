/// AI move delay timing.
///
/// Tuned for responsive, Apple-grade pacing so bot replies feel natural without stalling gameplay.

/// Pause before each bot move (milliseconds).
public let aiDelayMs: [AiDifficulty: Int] = [
    .easy: 750,
    .medium: 620,
    .hard: 520,
]

public let minAiDelayMs = 450

public func aiMoveDelay(_ difficulty: AiDifficulty) -> Int {
    max(aiDelayMs[difficulty]!, minAiDelayMs)
}

/// AI move delay as a `Duration` for use with `Task.sleep`.
public func aiMoveDelayDuration(_ difficulty: AiDifficulty) -> Duration {
    .milliseconds(aiMoveDelay(difficulty))
}
