import Foundation

/// Unified coordinator for audio and haptic feedback.
@MainActor
final class FeedbackManager {
    static let shared = FeedbackManager()

    var soundEnabled: Bool = true
    var hapticsEnabled: Bool = true

    private init() {}

    /// Pre-warms audio buffers and Taptic Engine generators at app launch so the very first tap is instant.
    func warmUp() {
        SoundManager.shared.warmUp()
        HapticsEngine.shared.prepare()
    }

    func trigger(_ event: FeedbackEvent) {
        HapticsEngine.shared.trigger(event, enabled: hapticsEnabled)
        SoundManager.shared.play(event, enabled: soundEnabled)
    }
}
