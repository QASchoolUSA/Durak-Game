import Foundation

/// Stores the active online multiplayer room session for seamless reconnection.
@Observable
final class SessionStore {
    static let shared = SessionStore()

    private enum Keys {
        static let roomCode = "durak_session_room_code"
        static let playerId = "durak_session_player_id"
    }

    struct Session: Codable, Equatable, Sendable {
        let roomCode: String
        let playerId: String
    }

    var currentSession: Session? {
        didSet {
            if let session = currentSession {
                UserDefaults.standard.set(session.roomCode, forKey: Keys.roomCode)
                UserDefaults.standard.set(session.playerId, forKey: Keys.playerId)
            } else {
                UserDefaults.standard.removeObject(forKey: Keys.roomCode)
                UserDefaults.standard.removeObject(forKey: Keys.playerId)
            }
        }
    }

    private init() {
        if let code = UserDefaults.standard.string(forKey: Keys.roomCode),
           let pid = UserDefaults.standard.string(forKey: Keys.playerId) {
            self.currentSession = Session(roomCode: code, playerId: pid)
        } else {
            self.currentSession = nil
        }
    }

    func clear() {
        currentSession = nil
    }
}
