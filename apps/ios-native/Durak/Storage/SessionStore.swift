import Foundation

/// Stores the active online multiplayer room session for seamless reconnection.
@Observable
final class SessionStore {
    static let shared = SessionStore()

    private enum Keys {
        static let roomId = "durak_session_room_id"
        static let roomCode = "durak_session_room_code"
        static let playerId = "durak_session_player_id"
    }

    struct Session: Codable, Equatable, Sendable {
        let roomId: String
        let roomCode: String
        let playerId: String
    }

    var currentSession: Session? {
        didSet {
            if let session = currentSession {
                UserDefaults.standard.set(session.roomId, forKey: Keys.roomId)
                UserDefaults.standard.set(session.roomCode, forKey: Keys.roomCode)
                UserDefaults.standard.set(session.playerId, forKey: Keys.playerId)
            } else {
                UserDefaults.standard.removeObject(forKey: Keys.roomId)
                UserDefaults.standard.removeObject(forKey: Keys.roomCode)
                UserDefaults.standard.removeObject(forKey: Keys.playerId)
            }
        }
    }

    private init() {
        if let code = UserDefaults.standard.string(forKey: Keys.roomCode),
           let pid = UserDefaults.standard.string(forKey: Keys.playerId) {
            let roomId = UserDefaults.standard.string(forKey: Keys.roomId) ?? ""
            self.currentSession = Session(roomId: roomId, roomCode: code, playerId: pid)
        } else {
            self.currentSession = nil
        }
    }

    func clear() {
        currentSession = nil
    }
}
