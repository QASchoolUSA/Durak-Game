import Foundation
import AVFoundation

/// Zero-latency audio player for UI and gameplay sound effects.
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
        case shuffle
        case draw
        case turnStart = "turn-start"
    }

    private let eventSoundMap: [FeedbackEvent: SoundKey] = [
        .uiTap: .tap,
        .selection: .tap,
        .confirm: .tap,
        .cardPlay: .cardPlay,
        // Card-from-deck / take-from-table: shared draw clip, rate-matched in `eventRates`.
        .takeCards: .draw,
        .gameStart: .gameStart,
        .roundClear: .roundClear,
        .deal: .draw,
        .shuffle: .shuffle,
        .turnStart: .turnStart,
        .timerWarning: .tick,
        .timerCritical: .tick,
        .timerExpired: .confirm,
        .success: .success,
        .failure: .failure,
        .error: .failure
    ]

    /// Playback rates so longer clips match motion / impact feel.
    /// deal ≈ deck→hand (~0.34s); take ≈ table sweep (~0.42s).
    /// cardPlay is a trimmed slap (~0.11s) — play at 1.0 so the hit isn't stretched late.
    private let eventRates: [FeedbackEvent: Float] = [
        .deal: 1.9,
        .takeCards: 1.55,
        .cardPlay: 1.0
    ]

    private let keyVolumes: [SoundKey: Float] = [
        .tap: 0.72,
        .confirm: 0.78,
        .roundClear: 0.55,
        .deal: 0.6,
        .shuffle: 0.65,
        .draw: 0.7,
        .cardPlay: 0.82,
        .turnStart: 0.45
    ]

    private var players: [SoundKey: AVAudioPlayer] = [:]
    /// Pool for instant UI taps so rapid menu interactions never stall on buffer rewind.
    private var tapPool: [AVAudioPlayer] = []
    private var tapPoolIndex = 0
    private let tapPoolSize = 4
    /// Pool so staggered multi-card deals can overlap without cutting each other off.
    private var drawPool: [AVAudioPlayer] = []
    private var drawPoolIndex = 0
    private let drawPoolSize = 4
    /// Pool for rapid table lands (human + AI / multi-pair).
    private var cardPlayPool: [AVAudioPlayer] = []
    private var cardPlayPoolIndex = 0
    private let cardPlayPoolSize = 3
    private var isAudioSessionConfigured = false

    /// Prevent double-firing identical sounds within the same render frame (16ms).
    private var lastPlayedTimestamp: [SoundKey: TimeInterval] = [:]
    private let minRetriggerInterval: TimeInterval = 0.018

    private init() {
        configureAudioSession()
        preloadAllSounds()
    }

    /// Ensures SoundManager is initialized and audio buffers are pre-warmed at app launch.
    func warmUp() {
        configureAudioSession()
    }

    private func configureAudioSession() {
        guard !isAudioSessionConfigured else { return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            // Request ultra-low 5ms IO buffer duration for instant game audio response
            try? session.setPreferredIOBufferDuration(0.005)
            try session.setActive(true)
            isAudioSessionConfigured = true
        } catch {
            print("[SoundManager] Failed to set audio session: \(error)")
        }
    }

    private func preloadAllSounds() {
        for key in SoundKey.allCases {
            _ = player(for: key)
        }
        _ = tapPlayers()
        _ = drawPlayers()
        _ = cardPlayPlayers()
    }

    private func url(for key: SoundKey) -> URL? {
        Bundle.main.url(forResource: key.rawValue, withExtension: "wav", subdirectory: "Sounds")
            ?? Bundle.main.url(forResource: key.rawValue, withExtension: "wav")
    }

    /// Only enable time-pitch rate scaling on sounds that actually vary their rate.
    /// `enableRate = true` attaches an pitch-shift DSP unit with ~15-25ms lookahead latency.
    private func needsVariableRate(_ key: SoundKey) -> Bool {
        key == .draw
    }

    private func makePlayer(for key: SoundKey) -> AVAudioPlayer? {
        guard let url = url(for: key) else { return nil }
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.volume = keyVolumes[key] ?? 0.80
            if needsVariableRate(key) {
                player.enableRate = true
                player.rate = 1.0
            }
            player.prepareToPlay()
            return player
        } catch {
            print("[SoundManager] Failed to load sound \(key.rawValue): \(error)")
            return nil
        }
    }

    private func player(for key: SoundKey) -> AVAudioPlayer? {
        if let existing = players[key] {
            return existing
        }
        guard let player = makePlayer(for: key) else { return nil }
        players[key] = player
        return player
    }

    private func tapPlayers() -> [AVAudioPlayer] {
        if tapPool.count == tapPoolSize { return tapPool }
        tapPool = (0..<tapPoolSize).compactMap { _ in makePlayer(for: .tap) }
        return tapPool
    }

    private func drawPlayers() -> [AVAudioPlayer] {
        if drawPool.count == drawPoolSize { return drawPool }
        drawPool = (0..<drawPoolSize).compactMap { _ in makePlayer(for: .draw) }
        return drawPool
    }

    private func cardPlayPlayers() -> [AVAudioPlayer] {
        if cardPlayPool.count == cardPlayPoolSize { return cardPlayPool }
        cardPlayPool = (0..<cardPlayPoolSize).compactMap { _ in makePlayer(for: .cardPlay) }
        return cardPlayPool
    }

    private func playFromPool(
        _ pool: [AVAudioPlayer],
        index: inout Int,
        rate: Float? = nil,
        volume: Float? = nil
    ) {
        guard !pool.isEmpty else { return }
        let player = pool[index % pool.count]
        index = (index + 1) % pool.count
        if let rate, player.enableRate {
            player.rate = max(0.5, min(rate, 2.0))
        }
        if let volume {
            player.volume = volume
        }
        if player.isPlaying {
            player.currentTime = 0
        } else {
            player.currentTime = 0
        }
        player.play()
    }

    func play(_ event: FeedbackEvent, enabled: Bool = true) {
        guard enabled else { return }
        guard let key = eventSoundMap[event] else { return }

        // Deduplicate rapid double-triggers within the same frame (except staggered deals)
        let now = ProcessInfo.processInfo.systemUptime
        if event != .deal, let last = lastPlayedTimestamp[key], (now - last) < minRetriggerInterval {
            return
        }
        lastPlayedTimestamp[key] = now

        if key == .tap {
            playFromPool(tapPool, index: &tapPoolIndex)
            return
        }

        if key == .draw {
            playFromPool(drawPool, index: &drawPoolIndex, rate: eventRates[event] ?? 1.0)
            return
        }

        if key == .cardPlay {
            playFromPool(cardPlayPool, index: &cardPlayPoolIndex)
            return
        }

        guard let player = player(for: key) else { return }
        if player.enableRate {
            player.rate = eventRates[event] ?? 1.0
        }
        if player.isPlaying {
            player.currentTime = 0
        }
        player.play()
    }
}
