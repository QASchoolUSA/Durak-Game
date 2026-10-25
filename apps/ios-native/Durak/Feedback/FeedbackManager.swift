import Foundation

/// Unified coordinator for audio and haptic feedback.
@MainActor
final class FeedbackManager {
    static let shared = FeedbackManager()

    var soundEnabled: Bool = true
    var hapticsEnabled: Bool = true

    private init() {}

    func trigger(_ event: FeedbackEvent) {
        SoundManager.shared.play(event, enabled: soundEnabled)
        HapticsEngine.shared.trigger(event, enabled: hapticsEnabled)
    }
}
