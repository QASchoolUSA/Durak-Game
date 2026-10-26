import Foundation

/// Lightweight async/await HTTP client communicating with Convex backend endpoints.
/// Named separately from ConvexMobile's `ConvexClient` to avoid type collisions.
actor ConvexHTTPClient {
    static let shared = ConvexHTTPClient()

    static let deploymentURL = "https://marvelous-marlin-178.convex.cloud"

    let baseUrl: URL
    private var authToken: String?

    /// Per-request timeout (flaky mobile WiFi should fail fast and retry).
    private let requestTimeoutSeconds: TimeInterval = 12
    private let maxTransientRetries = 1

    enum ConvexError: LocalizedError {
        case invalidURL
        case requestFailed(statusCode: Int, message: String)
        case serverError(String)
        case decodingError(Error)
        case timedOut

        var errorDescription: String? {
            switch self {
            case .invalidURL: return "Invalid Convex deployment URL."
            case .requestFailed(let code, let msg): return "HTTP \(code): \(msg)"
            case .serverError(let msg): return "Convex Error: \(msg)"
            case .decodingError(let err): return "Failed to decode response: \(err.localizedDescription)"
            case .timedOut: return "Request timed out."
            }
        }
    }

    init(baseUrlString: String = ConvexHTTPClient.deploymentURL) {
        self.baseUrl = URL(string: baseUrlString)!
        self.authToken = KeychainStore.shared.loadString(key: "convex_auth_token")
    }

    func setAuthToken(_ token: String?) {
        self.authToken = token
        if let token {
            _ = KeychainStore.shared.save(key: "convex_auth_token", string: token)
        } else {
            _ = KeychainStore.shared.delete(key: "convex_auth_token")
        }
    }

    // MARK: - Query

    func query<T: Decodable>(_ path: String, args: [String: Any] = [:]) async throws -> T {
        return try await send(endpoint: "api/query", path: path, args: args, retryTransient: false)
    }

    // MARK: - Mutation

    func mutation<T: Decodable>(
        _ path: String,
        args: [String: Any] = [:],
        retryTransient: Bool = false
    ) async throws -> T {
        return try await send(
            endpoint: "api/mutation",
            path: path,
            args: args,
            retryTransient: retryTransient
        )
    }

    // MARK: - Action

    func action<T: Decodable>(_ path: String, args: [String: Any] = [:]) async throws -> T {
        return try await send(endpoint: "api/action", path: path, args: args, retryTransient: false)
    }

    // MARK: - Private Transport

    private struct ConvexResponse<U: Decodable>: Decodable {
        let status: String
        let value: U?
        let errorMessage: String?
        let errorData: AnyCodable?
    }

    private func send<T: Decodable>(
        endpoint: String,
        path: String,
        args: [String: Any],
        retryTransient: Bool
    ) async throws -> T {
        var attempt = 0
        var lastError: Error?
        let maxAttempts = retryTransient ? (1 + maxTransientRetries) : 1

        while attempt < maxAttempts {
            do {
                return try await sendOnce(endpoint: endpoint, path: path, args: args)
            } catch {
                lastError = error
                attempt += 1
                guard retryTransient, attempt < maxAttempts, isTransient(error) else {
                    throw error
                }
                let backoffMs = UInt64(250 * attempt)
                try? await Task.sleep(for: .milliseconds(backoffMs))
            }
        }
        throw lastError ?? ConvexError.serverError("Request failed")
    }

    private func isTransient(_ error: Error) -> Bool {
        if case ConvexError.timedOut = error { return true }
        if case ConvexError.requestFailed(let code, _) = error {
            return code == 408 || code == 429 || (500...599).contains(code)
        }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain {
            switch ns.code {
            case NSURLErrorTimedOut,
                 NSURLErrorNetworkConnectionLost,
                 NSURLErrorNotConnectedToInternet,
                 NSURLErrorCannotConnectToHost,
                 NSURLErrorDNSLookupFailed:
                return true
            default:
                break
            }
        }
        return false
    }

    private func sendOnce<T: Decodable>(
        endpoint: String,
        path: String,
        args: [String: Any]
    ) async throws -> T {
        guard let url = URL(string: endpoint, relativeTo: baseUrl) else {
            throw ConvexError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = requestTimeoutSeconds

        // Never send Bearer token to auth:signIn (it's a public authentication endpoint)
        if let token = authToken, path != "auth:signIn" {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let bodyPayload: [String: Any] = [
            "path": path,
            "args": args,
            "format": "json"
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: bodyPayload)

        NSLog("[ConvexClient] POST %@ path=%@ (hasAuth=%@)", endpoint, path, (authToken != nil && path != "auth:signIn") ? "YES" : "NO")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            let ns = error as NSError
            if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorTimedOut {
                throw ConvexError.timedOut
            }
            throw error
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ConvexError.requestFailed(statusCode: 0, message: "Non-HTTP response")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorText = String(data: data, encoding: .utf8) ?? "Unknown server error"
            if httpResponse.statusCode == 401 {
                self.authToken = nil
                _ = KeychainStore.shared.delete(key: "convex_auth_token")
            }
            NSLog("[ConvexClient] FAILED [%ld] for %@ (%@): %@", httpResponse.statusCode, endpoint, path, errorText)
            throw ConvexError.requestFailed(statusCode: httpResponse.statusCode, message: errorText)
        }

        let decoder = JSONDecoder()
        do {
            let res = try decoder.decode(ConvexResponse<T>.self, from: data)
            if res.status == "success" {
                if let value = res.value {
                    return value
                }
                if let empty = EmptyResponse() as? T {
                    return empty
                }
                if let nilValue = (Optional<Any>.none as? T) {
                    return nilValue
                }
                throw ConvexError.serverError("Response succeeded with null value")
            } else {
                throw ConvexError.serverError(res.errorMessage ?? "Unknown error")
            }
        } catch let err as ConvexError {
            throw err
        } catch {
            throw ConvexError.decodingError(error)
        }
    }
}

/// Empty response for mutations that return no value or null.
struct EmptyResponse: Codable, Sendable {
    public init() {}
}

/// Type-erased wrapper for dynamic JSON encodable/decodable fields.
struct AnyCodable: Codable, @unchecked Sendable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported AnyCodable value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            let context = EncodingError.Context(codingPath: container.codingPath, debugDescription: "Cannot encode value of type \(type(of: value))")
            throw EncodingError.invalidValue(value, context)
        }
    }
}
