import Combine
import Foundation
import ConvexMobile

/// Auth bridge: reuse the Keychain JWT already managed by `ConvexAuth` / `ConvexHTTPClient`.
private struct KeychainConvexAuthProvider: AuthProvider {
    typealias T = String

    func login(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
        try await ConvexAuth.shared.ensureAuthenticated()
        guard let token = KeychainStore.shared.loadString(key: "convex_auth_token") else {
            throw ConvexHTTPClient.ConvexError.serverError("Missing Convex auth token")
        }
        onIdToken(token)
        return token
    }

    func loginFromCache(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
        if let token = KeychainStore.shared.loadString(key: "convex_auth_token") {
            onIdToken(token)
            return token
        }
        return try await login(onIdToken: onIdToken)
    }

    func logout() async throws {}

    func extractIdToken(from authResult: String) -> String {
        authResult
    }
}

/// Live WebSocket subscribe to `rooms:getRoomView` via ConvexMobile.
/// Decodes Convex's `$integer` / `$float` wire format into standard JSON, then into `OnlineBridge.RoomView`.
@MainActor
final class ConvexLiveClient {
    static let shared = ConvexLiveClient()

    private let client: ConvexClientWithAuth<String>
    private var authReady = false
    private var roomSubscription: AnyCancellable?

    private init() {
        client = ConvexClientWithAuth(
            deploymentUrl: ConvexHTTPClient.deploymentURL,
            authProvider: KeychainConvexAuthProvider()
        )
    }

    func ensureAuth() async throws {
        if authReady { return }
        let result = await client.loginFromCache()
        switch result {
        case .success:
            authReady = true
        case .failure(let error):
            let retry = await client.login()
            switch retry {
            case .success:
                authReady = true
            case .failure:
                throw error
            }
        }
    }

    /// Starts a live subscription. Invokes `onView` on every server push (including null → not called).
    func subscribeRoomView(
        roomId: String,
        onView: @escaping @MainActor (OnlineBridge.RoomView) -> Void,
        onFailure: @escaping @MainActor (Error) -> Void
    ) async {
        roomSubscription?.cancel()
        roomSubscription = nil

        do {
            try await ensureAuth()
        } catch {
            onFailure(error)
            return
        }

        let publisher = client.subscribe(
            to: "rooms:getRoomView",
            with: ["roomId": roomId],
            yielding: AnyCodable?.self
        )

        roomSubscription = publisher.sink(
            receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    Task { @MainActor in
                        onFailure(error)
                    }
                }
            },
            receiveValue: { payload in
                Task { @MainActor in
                    guard let payload else { return }
                    do {
                        let view = try Self.decodeRoomView(from: payload.value)
                        onView(view)
                    } catch {
                        NSLog("[LIVE] decode failed: %@", error.localizedDescription)
                        onFailure(error)
                    }
                }
            }
        )
    }

    func stop() {
        roomSubscription?.cancel()
        roomSubscription = nil
    }

    // MARK: - Convex wire JSON → RoomView

    private static func decodeRoomView(from value: Any) throws -> OnlineBridge.RoomView {
        let normalized = normalizeConvexJSON(value)
        let data = try JSONSerialization.data(withJSONObject: normalized, options: [])
        return try JSONDecoder().decode(OnlineBridge.RoomView.self, from: data)
    }

    /// Walk ConvexMobile JSON and replace `{"$integer":"<b64>"}` / `{"$float":"<b64>"}` with numbers.
    private static func normalizeConvexJSON(_ value: Any) -> Any {
        if let dict = value as? [String: Any] {
            if dict.count == 1, let b64 = dict["$integer"] as? String,
               let data = Data(base64Encoded: b64) {
                let intVal: Int64 = data.withUnsafeBytes { raw in
                    raw.load(as: Int64.self)
                }
                return NSNumber(value: intVal)
            }
            if dict.count == 1, let b64 = dict["$float"] as? String,
               let data = Data(base64Encoded: b64) {
                let doubleVal: Double = data.withUnsafeBytes { raw in
                    raw.load(as: Double.self)
                }
                return NSNumber(value: doubleVal)
            }
            var out: [String: Any] = [:]
            out.reserveCapacity(dict.count)
            for (key, nested) in dict {
                out[key] = normalizeConvexJSON(nested)
            }
            return out
        }
        if let array = value as? [Any] {
            return array.map { normalizeConvexJSON($0) }
        }
        return value
    }
}
