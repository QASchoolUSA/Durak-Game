import UIKit
import CoreHaptics

/// All feedback events mapped across haptics and sounds.
enum FeedbackEvent: String, CaseIterable, Sendable {
    case uiTap
    case selection
    case confirm
    case gameStart
    case cardPlay
    case takeCards
    case roundClear
    case deal
    case turnStart
    case timerWarning
    case timerCritical
    case timerExpired
    case success
    case failure
    case error
}

/// Native iOS haptic feedback engine supporting UIKit feedback generators and CoreHaptics.
@MainActor
final class HapticsEngine {
    static let shared = HapticsEngine()

    private var hapticEngine: CHHapticEngine?
    private var supportsHaptics: Bool = false

    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let selectionFeedback = UISelectionFeedbackGenerator()
    private let notificationFeedback = UINotificationFeedbackGenerator()

    private init() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        if supportsHaptics {
            do {
                hapticEngine = try CHHapticEngine()
                try hapticEngine?.start()
                hapticEngine?.resetHandler = { [weak self] in
                    try? self?.hapticEngine?.start()
                }
            } catch {
                hapticEngine = nil
            }
        }
        prepare()
    }

    func prepare() {
        lightImpact.prepare()
        mediumImpact.prepare()
        heavyImpact.prepare()
        selectionFeedback.prepare()
        notificationFeedback.prepare()
    }

    func trigger(_ event: FeedbackEvent, enabled: Bool = true) {
        guard enabled else { return }

        switch event {
        case .uiTap, .timerWarning, .roundClear, .turnStart:
            lightImpact.impactOccurred()
        case .selection:
            selectionFeedback.selectionChanged()
        case .confirm, .cardPlay, .timerCritical:
            mediumImpact.impactOccurred()
        case .gameStart, .timerExpired:
            heavyImpact.impactOccurred()
        case .takeCards:
            notificationFeedback.notificationOccurred(.warning)
        case .deal:
            lightImpact.impactOccurred(intensity: 0.7)
        case .success:
            notificationFeedback.notificationOccurred(.success)
        case .failure, .error:
            notificationFeedback.notificationOccurred(.error)
        }
    }
}
