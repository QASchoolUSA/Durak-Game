import Foundation
import AVFoundation

/// Low-latency audio player for sound effects.
@MainActor
final class SoundManager {
    static let shared = SoundManager()

    private enum SoundKey: String, CaseIterable {
        case tap
        case confirm
        case cardPlay = "card-play"
        case take
        case gameStart = "game-start"
        case success
        case failure
        case tick
        case roundClear = "round-clear"
        case deal
        case turnStart = "turn-start"
    }

    private let eventSoundMap: [FeedbackEvent: SoundKey] = [
        .uiTap: .tap,
        .selection: .tap,
        .confirm: .confirm,
        .cardPlay: .cardPlay,
        .takeCards: .take,
        .gameStart: .gameStart,
        .roundClear: .roundClear,
        .deal: .deal,
        .turnStart: .turnStart,
        .timerWarning: .tick,
        .timerCritical: .tick,
        .timerExpired: .confirm,
        .success: .success,
        .failure: .failure,
        .error: .failure
    ]

    private let keyVolumes: [SoundKey: Float] = [
        .roundClear: 0.55,
        .deal: 0.6,
        .turnStart: 0.45
    ]

    private var players: [SoundKey: AVAudioPlayer] = [:]
    private var isAudioSessionConfigured = false

    private init() {
        configureAudioSession()
        preloadCommonSounds()
    }

    private func configureAudioSession() {
        guard !isAudioSessionConfigured else { return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            isAudioSessionConfigured = true
        } catch {
            print("[SoundManager] Failed to set audio session: \(error)")
        }
    }

    private func preloadCommonSounds() {
        for key in [SoundKey.tap, .cardPlay, .confirm, .deal] {
            _ = player(for: key)
        }
    }

    private func player(for key: SoundKey) -> AVAudioPlayer? {
        if let existing = players[key] {
            return existing
        }

        guard let url = Bundle.main.url(forResource: key.rawValue, withExtension: "wav", subdirectory: "Sounds")
                ?? Bundle.main.url(forResource: key.rawValue, withExtension: "wav") else {
            return nil
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.volume = keyVolumes[key] ?? 0.85
            player.prepareToPlay()
            players[key] = player
            return player
        } catch {
            print("[SoundManager] Failed to load sound \(key.rawValue): \(error)")
            return nil
        }
    }

    func play(_ event: FeedbackEvent, enabled: Bool = true) {
        guard enabled else { return }
        guard let key = eventSoundMap[event] else { return }

        guard let player = player(for: key) else { return }
        if player.isPlaying {
            player.currentTime = 0
        }
        player.play()
    }
}
