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
    case shuffle
    case turnStart
    case timerWarning
    case timerCritical
    case timerExpired
    case success
    case failure
    case error
}

/// Native iOS haptic feedback engine supporting UIKit feedback generators and CoreHaptics.
/// Keeps the Taptic Engine continuously prepared for sub-millisecond tactile response.
@MainActor
final class HapticsEngine {
    static let shared = HapticsEngine()

    private var hapticEngine: CHHapticEngine?
    private var supportsHaptics: Bool = false

    private let softImpact = UIImpactFeedbackGenerator(style: .soft)
    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let rigidImpact = UIImpactFeedbackGenerator(style: .rigid)
    private let selectionFeedback = UISelectionFeedbackGenerator()
    private let notificationFeedback = UINotificationFeedbackGenerator()

    private var lastTriggerTime: TimeInterval = 0
    private let minRetriggerInterval: TimeInterval = 0.014

    private init() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        if supportsHaptics {
            do {
                hapticEngine = try CHHapticEngine()
                hapticEngine?.playsHapticsOnly = true
                hapticEngine?.isAutoShutdownEnabled = true
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
        softImpact.prepare()
        lightImpact.prepare()
        mediumImpact.prepare()
        heavyImpact.prepare()
        rigidImpact.prepare()
        selectionFeedback.prepare()
        notificationFeedback.prepare()
    }

    func trigger(_ event: FeedbackEvent, enabled: Bool = true) {
        guard enabled else { return }

        let now = ProcessInfo.processInfo.systemUptime
        if event != .deal && (now - lastTriggerTime) < minRetriggerInterval {
            return
        }
        lastTriggerTime = now

        switch event {
        case .uiTap:
            rigidImpact.impactOccurred(intensity: 0.55)
            rigidImpact.prepare()
        case .timerWarning, .roundClear, .turnStart:
            lightImpact.impactOccurred()
            lightImpact.prepare()
        case .selection:
            selectionFeedback.selectionChanged()
            selectionFeedback.prepare()
        case .confirm:
            mediumImpact.impactOccurred(intensity: 0.8)
            mediumImpact.prepare()
        case .cardPlay:
            rigidImpact.impactOccurred(intensity: 0.85)
            rigidImpact.prepare()
        case .timerCritical:
            mediumImpact.impactOccurred()
            mediumImpact.prepare()
        case .gameStart, .timerExpired:
            heavyImpact.impactOccurred()
            heavyImpact.prepare()
        case .takeCards:
            softImpact.impactOccurred(intensity: 0.9)
            softImpact.prepare()
        case .deal:
            softImpact.impactOccurred(intensity: 0.55)
            softImpact.prepare()
        case .shuffle:
            mediumImpact.impactOccurred(intensity: 0.70)
            mediumImpact.prepare()
        case .success:
            notificationFeedback.notificationOccurred(.success)
            notificationFeedback.prepare()
        case .failure, .error:
            notificationFeedback.notificationOccurred(.error)
            notificationFeedback.prepare()
        }
    }
}
