import Foundation

/// Handles Convex authentication token persistence and anonymous session minting.
@MainActor
final class ConvexAuth {
    static let shared = ConvexAuth()

    private enum Keys {
        static let token = "convex_auth_token"
        static let refreshToken = "convex_refresh_token"
        static let userId = "durak_user_id"
    }

    private(set) var currentUserId: String?

    private init() {
        self.currentUserId = KeychainStore.shared.loadString(key: Keys.userId)
        if let token = KeychainStore.shared.loadString(key: Keys.token) {
            Task {
                await ConvexClient.shared.setAuthToken(token)
            }
        }
    }

    /// Clears any cached credentials and resets the client's auth state.
    func clearSession() {
        _ = KeychainStore.shared.delete(key: Keys.token)
        _ = KeychainStore.shared.delete(key: Keys.refreshToken)
        _ = KeychainStore.shared.delete(key: Keys.userId)
        self.currentUserId = nil
        Task {
            await ConvexClient.shared.setAuthToken(nil)
        }
    }

    /// Ensures the client has a valid Convex auth session (guest or existing).
    func ensureAuthenticated() async throws {
        // If we already have a token, check if it's set and not expired
        if let token = KeychainStore.shared.loadString(key: Keys.token) {
            if !isTokenExpired(token) {
                await ConvexClient.shared.setAuthToken(token)
                if self.currentUserId == nil, let sub = extractSubject(from: token) {
                    self.currentUserId = sub
                }
                await ensureWallet()
                return
            }

            // Attempt token refresh if refresh token exists
            if let refresh = KeychainStore.shared.loadString(key: Keys.refreshToken) {
                do {
                    await ConvexClient.shared.setAuthToken(nil)
                    try await performSignIn(args: ["refreshToken": refresh])
                    await ensureWallet()
                    return
                } catch {
                    // Stale refresh token, fall back to anonymous below
                    _ = KeychainStore.shared.delete(key: Keys.refreshToken)
                    _ = KeychainStore.shared.delete(key: Keys.token)
                }
            }
        }

        // Clear stale token before minting guest session
        await ConvexClient.shared.setAuthToken(nil)

        // Mint anonymous guest session
        try await performSignIn(args: [
            "provider": "anonymous",
            "params": [:] as [String: String]
        ])
        await ensureWallet()
    }

    func ensureWallet() async {
        struct WalletResult: Decodable {
            let creditBalance: Double?
            let goldBalance: Double?
        }
        let _: WalletResult? = try? await ConvexClient.shared.mutation("wallets:ensureWallet", args: [:])
    }

    private func performSignIn(args: [String: Any]) async throws {
        struct SignInResult: Decodable {
            struct Tokens: Decodable {
                let token: String
                let refreshToken: String
            }
            let tokens: Tokens?
        }

        let res: SignInResult = try await ConvexClient.shared.action("auth:signIn", args: args)
        guard let tokens = res.tokens else {
            throw ConvexClient.ConvexError.serverError("No tokens returned from auth:signIn")
        }

        _ = KeychainStore.shared.save(key: Keys.token, string: tokens.token)
        _ = KeychainStore.shared.save(key: Keys.refreshToken, string: tokens.refreshToken)
        await ConvexClient.shared.setAuthToken(tokens.token)

        if let sub = extractSubject(from: tokens.token) {
            self.currentUserId = sub
            _ = KeychainStore.shared.save(key: Keys.userId, string: sub)
        }
    }

    private func isTokenExpired(_ token: String) -> Bool {
        guard let exp = extractExpiration(from: token) else { return true }
        return Date().timeIntervalSince1970 >= (exp - 60)
    }

    private func extractSubject(from jwt: String) -> String? {
        guard let claims = decodeJwtClaims(jwt) else { return nil }
        return claims["sub"] as? String
    }

    private func extractExpiration(from jwt: String) -> TimeInterval? {
        guard let claims = decodeJwtClaims(jwt) else { return nil }
        return claims["exp"] as? TimeInterval
    }

    private func decodeJwtClaims(_ jwt: String) -> [String: Any]? {
        let parts = jwt.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var base64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 {
            base64.append("=")
        }
        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json
    }
}
