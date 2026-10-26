import Foundation
import DurakGameCore

/// Bridge connecting native iOS game state to the Convex online multiplayer backend.
@Observable
@MainActor
final class OnlineBridge {
    static let shared = OnlineBridge()

    struct RoomMember: Codable, Sendable, Identifiable {
        var id: Int { Int(seatIndex) }
        let displayName: String
        let seatIndex: Double
        let isBot: Bool
        let isReady: Bool?
        let isSelf: Bool?
        let playerId: String?
        /// Per-seat AI difficulty; nil falls back to room config.
        let difficulty: String?
    }

    struct RoomConfig: Codable, Sendable {
        let numPlayers: Double
        let variant: String
        let throwInScope: String
        let playStyle: String
        let difficulty: String
    }

    struct RoomView: Codable, Sendable {
        let roomId: String
        let code: String
        let status: String // "lobby", "playing", "finished"
        let isHost: Bool
        let config: RoomConfig?
        let members: [RoomMember]
        let humanCount: Double?
        let readyCount: Double?
        let allHumansReady: Bool?
        let yourIsReady: Bool?
        let yourPlayerId: String?
        let turnTimerSeconds: Double?
        let buyIn: Double?
        let names: [String: String]?
        let gameState: GameState?
        let lastMoveAt: Double?
        let turnDeadlineAt: Double?
        let turnClockPlayerId: String?
        /// "ok" | "reconnecting" | null when no clock.
        let turnClockConnection: String?
        /// Server monotonic version — clients ignore older payloads.
        let version: Double?
        /// Latest table reaction (emoji burst), if any.
        let recentReaction: RecentReaction?
    }

    struct RecentReaction: Codable, Sendable {
        let emoji: String
        let fromPlayerId: String
        let at: Double
    }

    struct ActiveRoomSummary: Codable, Sendable {
        let roomId: String
        let code: String
        let status: String
        let seatIndex: Double
        let yourPlayerId: String?
        let opponents: [String]
        let humanCount: Double
        let lastMoveAt: Double
        let isYourTurn: Bool
    }

    /// Shown when polls fail repeatedly or the player is evicted.
    var syncErrorMessage: String? = nil
    var activeRoomView: RoomView?
    var isPolling: Bool = false
    weak var gameVM: GameViewModel?

    /// Last applied server version (for ack-gated optimistic submits).
    var lastAppliedVersionForUI: Int { lastAppliedVersion }
    /// Consecutive poll failures (for soft "Slow connection" UI).
    var consecutiveFailuresForUI: Int { consecutivePollFailures }

    private var pollTask: Task<Void, Never>?
    private var touchTask: Task<Void, Never>?
    private var liveRetryTask: Task<Void, Never>?
    private var polledRoomId: String?
    private var lastAppliedVersion: Int = -1
    private var consecutivePollFailures: Int = 0

    /// Lobby / idle cadence.
    private let idlePollMs: UInt64 = 1800
    /// Playing-state cadence (and post-move baseline).
    private let playingPollMs: UInt64 = 400
    /// Burst cadence after local submit or a remote version bump.
    private let burstPollMs: UInt64 = 300
    private let burstWindowSeconds: TimeInterval = 2.0
    private let backgroundPollMs: UInt64 = 5000
    private let touchIntervalSeconds: TimeInterval = 30

    /// While `Date() < burstUntil`, use `burstPollMs`.
    private var burstUntil: Date = .distantPast
    /// Prefer live WebSocket subscribe while status is playing; fall back to fast poll.
    private var useLiveSubscribe = false
    private var liveSubscribeFailed = false
    /// Slow poll when the app is backgrounded (battery + reconnect on foreground).
    private var isAppActive: Bool = true

    private init() {}

    /// Call from SwiftUI `scenePhase` so poll/live recover after backgrounding.
    /// Background stamps away presence so opponents see reconnecting promptly.
    func setAppActive(_ active: Bool) {
        let wasActive = isAppActive
        isAppActive = active
        if !active {
            guard wasActive, let roomId = polledRoomId else { return }
            Task {
                let _: EmptyResponse? = try? await ConvexHTTPClient.shared.mutation(
                    "rooms:touchRoom",
                    args: ["roomId": roomId, "active": false]
                )
            }
            return
        }
        guard !wasActive else { return }
        liveSubscribeFailed = false
        enterBurstWindow()
        if let roomId = polledRoomId {
            startLiveSubscribeIfNeeded(roomId: roomId)
            pollNow()
            Task {
                let _: EmptyResponse? = try? await ConvexHTTPClient.shared.mutation(
                    "rooms:touchRoom",
                    args: ["roomId": roomId, "active": true]
                )
            }
        }
    }

    func createRoom(
        numPlayers: Int,
        variant: GameVariant,
        throwInScope: ThrowInScope = .all,
        playStyle: PlayStyle = .standard,
        difficulty: AiDifficulty = .medium,
        turnTimerSeconds: Int = 12,
        buyIn: Int = 100
    ) async throws -> (roomId: String, roomCode: String) {
        do {
            return try await executeCreateRoom(
                numPlayers: numPlayers,
                variant: variant,
                throwInScope: throwInScope,
                playStyle: playStyle,
                difficulty: difficulty,
                turnTimerSeconds: turnTimerSeconds,
                buyIn: buyIn
            )
        } catch ConvexHTTPClient.ConvexError.requestFailed(let code, _) where code == 401 {
            ConvexAuth.shared.clearSession()
            return try await executeCreateRoom(
                numPlayers: numPlayers,
                variant: variant,
                throwInScope: throwInScope,
                playStyle: playStyle,
                difficulty: difficulty,
                turnTimerSeconds: turnTimerSeconds,
                buyIn: buyIn
            )
        }
    }

    private func executeCreateRoom(
        numPlayers: Int,
        variant: GameVariant,
        throwInScope: ThrowInScope,
        playStyle: PlayStyle,
        difficulty: AiDifficulty,
        turnTimerSeconds: Int,
        buyIn: Int
    ) async throws -> (roomId: String, roomCode: String) {
        try await ConvexAuth.shared.ensureAuthenticated()
        let name = PlayerNameStore.shared.name.trimmingCharacters(in: .whitespaces)
        let displayName = name.isEmpty ? "Host" : name

        let args: [String: Any] = [
            "displayName": displayName,
            "config": [
                "numPlayers": numPlayers,
                "variant": variant.rawValue,
                "throwInScope": throwInScope.rawValue,
                "playStyle": playStyle.rawValue,
                "difficulty": difficulty.rawValue
            ],
            "turnTimerSeconds": turnTimerSeconds,
            "buyIn": buyIn
        ]

        struct CreateRoomResult: Decodable {
            let roomId: String
            let code: String
        }

        let res: CreateRoomResult = try await ConvexHTTPClient.shared.mutation("rooms:createRoom", args: args)
        SessionStore.shared.currentSession = SessionStore.Session(
            roomId: res.roomId,
            roomCode: res.code,
            playerId: ConvexAuth.shared.currentUserId ?? ""
        )
        startPolling(roomId: res.roomId)
        return (res.roomId, res.code)
    }

    func joinRoom(code: String, displayName: String) async throws -> (roomId: String, seatIndex: Int) {
        do {
            return try await executeJoinRoom(code: code, displayName: displayName)
        } catch ConvexHTTPClient.ConvexError.requestFailed(let codeNum, _) where codeNum == 401 {
            ConvexAuth.shared.clearSession()
            return try await executeJoinRoom(code: code, displayName: displayName)
        }
    }

    private func executeJoinRoom(code: String, displayName: String) async throws -> (roomId: String, seatIndex: Int) {
        try await ConvexAuth.shared.ensureAuthenticated()
        let name = displayName.trimmingCharacters(in: .whitespaces)
        let cleanName = name.isEmpty ? "Player" : name
        let cleanCode = code.trimmingCharacters(in: .whitespaces).uppercased()

        struct JoinResult: Decodable {
            let roomId: String
            let seatIndex: Double
        }

        let res: JoinResult = try await ConvexHTTPClient.shared.mutation(
            "rooms:joinRoom",
            args: [
                "code": cleanCode,
                "displayName": cleanName
            ]
        )

        SessionStore.shared.currentSession = SessionStore.Session(
            roomId: res.roomId,
            roomCode: cleanCode,
            playerId: ConvexAuth.shared.currentUserId ?? ""
        )
        startPolling(roomId: res.roomId)
        return (res.roomId, Int(res.seatIndex))
    }

    /// Resume an existing seat (Home banner / SessionStore). Starts poll + live sync.
    func resumeRoom(roomId: String, roomCode: String) {
        SessionStore.shared.currentSession = SessionStore.Session(
            roomId: roomId,
            roomCode: roomCode,
            playerId: ConvexAuth.shared.currentUserId ?? ""
        )
        startPolling(roomId: roomId)
        pollNow()
    }

    func fetchMyActiveRooms() async throws -> [ActiveRoomSummary] {
        try await ConvexAuth.shared.ensureAuthenticated()
        return try await ConvexHTTPClient.shared.query("rooms:myActiveRooms", args: [:])
    }

    func startPolling(roomId: String) {
        stopPolling()
        isPolling = true
        polledRoomId = roomId
        lastAppliedVersion = -1
        consecutivePollFailures = 0
        syncErrorMessage = nil
        liveSubscribeFailed = false
        useLiveSubscribe = false
        burstUntil = .distantPast

        pollTask = Task { [weak self] in
            var nextDelayMs = self?.idlePollMs ?? 1800
            while !Task.isCancelled {
                guard let self else { return }
                let delay = nextDelayMs

                // When live subscribe is active during play, poll slowly as a safety net only.
                // Background: always slow poll (battery); foreground burst recovers on resume.
                let skipFastFetch = await MainActor.run { () -> Bool in
                    if !self.isAppActive { return false }
                    return self.useLiveSubscribe && self.activeRoomView?.status == "playing"
                }

                if !skipFastFetch {
                    do {
                        let view: RoomView = try await ConvexHTTPClient.shared.query(
                            "rooms:getRoomView",
                            args: ["roomId": roomId]
                        )
                        nextDelayMs = await MainActor.run { () -> UInt64 in
                            guard !Task.isCancelled else { return delay }
                            guard self.polledRoomId == roomId else { return delay }
                            self.consecutivePollFailures = 0
                            self.syncErrorMessage = nil
                            var delayMs = self.applyPolledView(view, expectedRoomId: roomId)
                            if !self.isAppActive {
                                delayMs = max(delayMs, self.backgroundPollMs)
                            }
                            return delayMs
                        }
                    } catch {
                        NSLog("[POLL] FAILED: %@", error.localizedDescription)
                        nextDelayMs = await MainActor.run { () -> UInt64 in
                            guard !Task.isCancelled, self.polledRoomId == roomId else { return delay }
                            return self.handlePollFailure(error, roomId: roomId)
                        }
                    }
                } else {
                    nextDelayMs = await MainActor.run { self.idlePollMs }
                }

                await self.sleepInterruptibly(milliseconds: nextDelayMs)
            }
        }

        startTouchHeartbeat(roomId: roomId)
        startLiveSubscribeIfNeeded(roomId: roomId)
    }

    /// Force an immediate refresh after a local move submission.
    func pollNow() {
        guard let roomId = polledRoomId else { return }
        enterBurstWindow()
        Task { [weak self] in
            guard let self else { return }
            do {
                let view: RoomView = try await ConvexHTTPClient.shared.query(
                    "rooms:getRoomView",
                    args: ["roomId": roomId]
                )
                await MainActor.run {
                    guard self.polledRoomId == roomId else { return }
                    _ = self.applyPolledView(view, expectedRoomId: roomId)
                }
            } catch {
                NSLog("[POLL] pollNow FAILED: %@", error.localizedDescription)
            }
        }
    }

    private func enterBurstWindow() {
        burstUntil = Date().addingTimeInterval(burstWindowSeconds)
    }

    /// Sleep in short slices so burst / pollNow can take effect without waiting a full idle interval.
    private func sleepInterruptibly(milliseconds: UInt64) async {
        let slice: UInt64 = 100
        var remaining = milliseconds
        while remaining > 0 && !Task.isCancelled {
            let chunk = min(slice, remaining)
            try? await Task.sleep(for: .milliseconds(chunk))
            remaining -= chunk
            if Date() < burstUntil, remaining > burstPollMs {
                remaining = min(remaining, burstPollMs)
            }
        }
    }

    private func startLiveSubscribeIfNeeded(roomId: String) {
        guard !liveSubscribeFailed else {
            scheduleLiveSubscribeRetry(roomId: roomId)
            return
        }
        Task { [weak self] in
            guard let self else { return }
            await ConvexLiveClient.shared.subscribeRoomView(
                roomId: roomId,
                onView: { [weak self] view in
                    guard let self else { return }
                    guard self.polledRoomId == roomId else { return }
                    self.useLiveSubscribe = true
                    self.liveSubscribeFailed = false
                    self.consecutivePollFailures = 0
                    self.syncErrorMessage = nil
                    _ = self.applyPolledView(view, expectedRoomId: roomId, fromLive: true)
                },
                onFailure: { [weak self] error in
                    guard let self else { return }
                    NSLog("[LIVE] subscribe failed, falling back to poll: %@", error.localizedDescription)
                    self.useLiveSubscribe = false
                    self.liveSubscribeFailed = true
                    ConvexLiveClient.shared.stop()
                    self.enterBurstWindow()
                    self.scheduleLiveSubscribeRetry(roomId: roomId)
                }
            )
        }
    }

    /// After a WS failure, retry live subscribe instead of staying on poll forever.
    private func scheduleLiveSubscribeRetry(roomId: String) {
        liveRetryTask?.cancel()
        liveRetryTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(8))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self else { return }
                guard self.polledRoomId == roomId else { return }
                guard self.isAppActive else { return }
                self.liveSubscribeFailed = false
                self.startLiveSubscribeIfNeeded(roomId: roomId)
            }
        }
    }

    @discardableResult
    private func applyPolledView(
        _ view: RoomView,
        expectedRoomId: String,
        fromLive: Bool = false
    ) -> UInt64 {
        guard polledRoomId == expectedRoomId else { return idlePollMs }

        var versionBumped = false
        if let version = view.version {
            let v = Int(version)
            if v < lastAppliedVersion {
                return nextPollDelay(for: view)
            }
            if v > lastAppliedVersion {
                versionBumped = lastAppliedVersion >= 0
                lastAppliedVersion = v
            } else {
                lastAppliedVersion = v
            }
        }

        activeRoomView = view

        switch view.status {
        case "playing", "finished":
            gameVM?.syncOnlineView(view)
        case "lobby":
            // Stay on lobby screens; don't wipe mid-game UI from a race.
            break
        default:
            break
        }

        // Someone just moved — stay on fast cadence briefly (helps remotes + mover reconcile).
        if versionBumped && !fromLive {
            enterBurstWindow()
        }

        // Promote to live subscribe once we're playing (if not already failed).
        if view.status == "playing", !useLiveSubscribe, !liveSubscribeFailed {
            startLiveSubscribeIfNeeded(roomId: expectedRoomId)
        }

        return nextPollDelay(for: view)
    }

    private func nextPollDelay(for view: RoomView) -> UInt64 {
        if Date() < burstUntil {
            return burstPollMs
        }
        switch view.status {
        case "playing":
            // Live subscribe carries the hot path; keep a modest safety poll.
            return useLiveSubscribe ? idlePollMs : playingPollMs
        case "finished":
            return playingPollMs
        default:
            return idlePollMs
        }
    }

    private func handlePollFailure(_ error: Error, roomId: String) -> UInt64 {
        consecutivePollFailures += 1
        let message = error.localizedDescription.lowercased()

        let isAuth = message.contains("http 401") || message.contains("unauthorized")
        let isEvicted = message.contains("null value")
            || message.contains("not a member")
            || message.contains("room not found")

        if isAuth {
            Task {
                try? await ConvexAuth.shared.ensureAuthenticated()
            }
        }

        if isEvicted {
            syncErrorMessage = "You left this table or the room closed."
            clearLocalRoomSession()
            gameVM?.handleOnlineEviction()
            return idlePollMs
        }

        if consecutivePollFailures >= 6 {
            syncErrorMessage = "Connection issue — reconnecting…"
        } else if consecutivePollFailures >= 2 {
            // Soft hint surfaces via GameViewModel.slowConnectionNotice.
            gameVM?.slowConnectionNotice = "Slow connection"
        }

        // Back off while failing; still try to recover.
        let backoff = min(backgroundPollMs, idlePollMs * UInt64(min(consecutivePollFailures, 4)))
        return backoff
    }

    private func startTouchHeartbeat(roomId: String) {
        touchTask?.cancel()
        touchTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                guard !Task.isCancelled else { return }
                guard let self, self.polledRoomId == roomId else { return }
                let _: EmptyResponse? = try? await ConvexHTTPClient.shared.mutation(
                    "rooms:touchRoom",
                    args: ["roomId": roomId]
                )
            }
        }
    }

    func stopPolling() {
        isPolling = false
        polledRoomId = nil
        pollTask?.cancel()
        pollTask = nil
        touchTask?.cancel()
        touchTask = nil
        liveRetryTask?.cancel()
        liveRetryTask = nil
        useLiveSubscribe = false
        ConvexLiveClient.shared.stop()
    }

    func clearLocalRoomSession() {
        stopPolling()
        activeRoomView = nil
        lastAppliedVersion = -1
        consecutivePollFailures = 0
        liveSubscribeFailed = false
        burstUntil = .distantPast
        SessionStore.shared.clear()
    }

    func setLobbyBot(
        roomId: String,
        seatIndex: Int,
        enabled: Bool,
        difficulty: AiDifficulty? = nil
    ) async throws {
        let baseArgs: [String: Any] = [
            "roomId": roomId,
            "seatIndex": seatIndex,
            "enabled": enabled
        ]

        // Prefer per-seat difficulty when the deployed backend supports it.
        if enabled, let difficulty {
            var withDifficulty = baseArgs
            withDifficulty["difficulty"] = difficulty.rawValue
            do {
                let _: EmptyResponse = try await ConvexHTTPClient.shared.mutation(
                    "rooms:setLobbyBot",
                    args: withDifficulty
                )
                return
            } catch {
                // Undeployed backend rejects unknown `difficulty` — fall back.
                guard isConvexExtraFieldError(error, field: "difficulty") else { throw error }
                try await setRoomDifficulty(roomId: roomId, difficulty: difficulty)
            }
        }

        let _: EmptyResponse = try await ConvexHTTPClient.shared.mutation(
            "rooms:setLobbyBot",
            args: baseArgs
        )
    }

    func setLobbyBotDifficulty(
        roomId: String,
        seatIndex: Int,
        difficulty: AiDifficulty
    ) async throws {
        do {
            let _: EmptyResponse = try await ConvexHTTPClient.shared.mutation(
                "rooms:setLobbyBotDifficulty",
                args: [
                    "roomId": roomId,
                    "seatIndex": seatIndex,
                    "difficulty": difficulty.rawValue
                ]
            )
        } catch {
            // Mutation missing until Convex deploy — keep lobby usable via room default.
            try await setRoomDifficulty(roomId: roomId, difficulty: difficulty)
        }
    }

    /// True when Convex rejects an arg that isn't in the deployed validator yet.
    private func isConvexExtraFieldError(_ error: Error, field: String) -> Bool {
        let message = error.localizedDescription
        return message.contains("ArgumentValidationError")
            && message.contains("extra field")
            && message.contains(field)
    }

    func setRoomDifficulty(roomId: String, difficulty: AiDifficulty) async throws {
        let _: EmptyResponse = try await ConvexHTTPClient.shared.mutation(
            "rooms:setRoomDifficulty",
            args: [
                "roomId": roomId,
                "difficulty": difficulty.rawValue
            ]
        )
    }

    func startGame(roomId: String, soloWithAi: Bool = false) async throws {
        let _: EmptyResponse = try await ConvexHTTPClient.shared.mutation(
            "rooms:startGame",
            args: [
                "roomId": roomId,
                "soloWithAi": soloWithAi,
                "autoFillEmptySeats": false
            ]
        )
        pollNow()
    }

    func setReady(roomId: String, ready: Bool) async throws {
        let _: EmptyResponse = try await ConvexHTTPClient.shared.mutation(
            "rooms:setReady",
            args: [
                "roomId": roomId,
                "ready": ready
            ]
        )
    }

    func leaveRoom(roomId: String) async {
        clearLocalRoomSession()
        let _: EmptyResponse? = try? await ConvexHTTPClient.shared.mutation(
            "rooms:leaveRoom",
            args: ["roomId": roomId]
        )
    }

    /// Forfeit mid-match (or leave lobby/finished). Stops polling first so in-flight polls cannot resurrect state.
    func forfeit(roomId: String) async {
        clearLocalRoomSession()
        let _: EmptyResponse? = try? await ConvexHTTPClient.shared.mutation(
            "rooms:forfeit",
            args: ["roomId": roomId]
        )
    }

    struct SubmitMoveResult: Codable, Sendable {
        let deduped: Bool?
        let version: Double?
    }

    func submitMove(roomId: String, move: Move, clientMoveId: String) async throws {
        var cardPayload: [String: Any]? = nil
        var targetPayload: Int? = nil

        switch move {
        case .attack(_, let card):
            cardPayload = ["suit": card.suit.rawValue, "rank": card.rank.rawValue, "id": card.id]
        case .defend(_, let card, let target):
            cardPayload = ["suit": card.suit.rawValue, "rank": card.rank.rawValue, "id": card.id]
            targetPayload = target
        case .transfer(_, let card, let target):
            cardPayload = ["suit": card.suit.rawValue, "rank": card.rank.rawValue, "id": card.id]
            targetPayload = target
        case .take, .pass:
            break
        }

        var moveDict: [String: Any] = [
            "type": moveTypeString(move),
            "player": move.player
        ]
        if let cardPayload { moveDict["card"] = cardPayload }
        if let targetPayload { moveDict["target"] = targetPayload }

        let args: [String: Any] = [
            "roomId": roomId,
            "move": moveDict,
            "clientMoveId": clientMoveId
        ]

        // Soft-retry once on transient transport failure with the same clientMoveId.
        do {
            let _: SubmitMoveResult = try await ConvexHTTPClient.shared.mutation(
                "rooms:submitMove",
                args: args,
                retryTransient: true
            )
        } catch {
            // Older backends may not return {deduped,version} — accept EmptyResponse shape.
            if isDecodingShapeMismatch(error) {
                let _: EmptyResponse = try await ConvexHTTPClient.shared.mutation(
                    "rooms:submitMove",
                    args: args,
                    retryTransient: true
                )
            } else {
                throw error
            }
        }
        pollNow()
    }

    private func isDecodingShapeMismatch(_ error: Error) -> Bool {
        if case ConvexHTTPClient.ConvexError.decodingError = error { return true }
        return error.localizedDescription.lowercased().contains("decode")
    }

    private func moveTypeString(_ move: Move) -> String {
        switch move {
        case .attack: return "ATTACK"
        case .defend: return "DEFEND"
        case .transfer: return "TRANSFER"
        case .take: return "TAKE"
        case .pass: return "PASS"
        }
    }

    func sendReaction(roomId: String, emoji: String) async {
        let _: EmptyResponse? = try? await ConvexHTTPClient.shared.mutation(
            "rooms:sendReaction",
            args: [
                "roomId": roomId,
                "emoji": emoji
            ]
        )
    }
}
