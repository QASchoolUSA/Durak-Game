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
    }

    var activeRoomView: RoomView?
    var isPolling: Bool = false
    weak var gameVM: GameViewModel?
    private var pollTask: Task<Void, Never>?

    private init() {}

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
        } catch ConvexClient.ConvexError.requestFailed(let code, _) where code == 401 {
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

        let res: CreateRoomResult = try await ConvexClient.shared.mutation("rooms:createRoom", args: args)
        SessionStore.shared.currentSession = SessionStore.Session(
            roomCode: res.code,
            playerId: ConvexAuth.shared.currentUserId ?? ""
        )
        startPolling(roomId: res.roomId)
        return (res.roomId, res.code)
    }

    func joinRoom(code: String, displayName: String) async throws -> (roomId: String, seatIndex: Int) {
        do {
            return try await executeJoinRoom(code: code, displayName: displayName)
        } catch ConvexClient.ConvexError.requestFailed(let codeNum, _) where codeNum == 401 {
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

        let res: JoinResult = try await ConvexClient.shared.mutation(
            "rooms:joinRoom",
            args: [
                "code": cleanCode,
                "displayName": cleanName
            ]
        )

        SessionStore.shared.currentSession = SessionStore.Session(
            roomCode: cleanCode,
            playerId: ConvexAuth.shared.currentUserId ?? ""
        )
        startPolling(roomId: res.roomId)
        return (res.roomId, Int(res.seatIndex))
    }

    func startPolling(roomId: String) {
        stopPolling()
        isPolling = true

        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                do {
                    let view: RoomView = try await ConvexClient.shared.query(
                        "rooms:getRoomView",
                        args: ["roomId": roomId]
                    )
                    NSLog("[POLL] view.status=%@ hasGameState=%@", view.status, view.gameState != nil ? "YES" : "NO")
                    await MainActor.run {
                        guard let self else { return }
                        self.activeRoomView = view
                        if view.status == "playing" {
                            self.gameVM?.syncOnlineView(view)
                        }
                    }
                } catch {
                    NSLog("[POLL] FAILED: %@", error.localizedDescription)
                }
                try? await Task.sleep(for: .milliseconds(750))
            }
        }
    }

    func stopPolling() {
        isPolling = false
        pollTask?.cancel()
        pollTask = nil
    }

    func setLobbyBot(roomId: String, seatIndex: Int, enabled: Bool) async throws {
        let _: EmptyResponse = try await ConvexClient.shared.mutation(
            "rooms:setLobbyBot",
            args: [
                "roomId": roomId,
                "seatIndex": seatIndex,
                "enabled": enabled
            ]
        )
    }

    func setRoomDifficulty(roomId: String, difficulty: AiDifficulty) async throws {
        let _: EmptyResponse = try await ConvexClient.shared.mutation(
            "rooms:setRoomDifficulty",
            args: [
                "roomId": roomId,
                "difficulty": difficulty.rawValue
            ]
        )
    }

    func startGame(roomId: String, soloWithAi: Bool = false) async throws {
        let _: EmptyResponse = try await ConvexClient.shared.mutation(
            "rooms:startGame",
            args: [
                "roomId": roomId,
                "soloWithAi": soloWithAi,
                "autoFillEmptySeats": true
            ]
        )
    }

    func setReady(roomId: String, ready: Bool) async throws {
        let _: EmptyResponse = try await ConvexClient.shared.mutation(
            "rooms:setReady",
            args: [
                "roomId": roomId,
                "ready": ready
            ]
        )
    }

    func leaveRoom(roomId: String) async {
        stopPolling()
        let _: EmptyResponse? = try? await ConvexClient.shared.mutation(
            "rooms:leaveRoom",
            args: ["roomId": roomId]
        )
        SessionStore.shared.clear()
        activeRoomView = nil
    }

    func submitMove(roomId: String, move: Move) async throws {
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

        let _: EmptyResponse = try await ConvexClient.shared.mutation(
            "rooms:submitMove",
            args: [
                "roomId": roomId,
                "move": moveDict
            ]
        )
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
        let _: EmptyResponse? = try? await ConvexClient.shared.mutation(
            "rooms:sendReaction",
            args: [
                "roomId": roomId,
                "emoji": emoji
            ]
        )
    }
}
