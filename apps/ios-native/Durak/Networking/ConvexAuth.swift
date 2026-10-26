import Foundation
import AuthenticationServices
import CryptoKit
import Observation

/// Handles Convex authentication token persistence, Apple ID sign-in, Email/Password auth, and anonymous guest sessions.
@Observable
@MainActor
final class ConvexAuth {
    static let shared = ConvexAuth()

    enum AccountKind: String, Codable, Sendable {
        case guest
        case email
        case apple

        var badgeLabel: String {
            switch self {
            case .guest: return "GUEST"
            case .email: return "EMAIL"
            case .apple: return "APPLE ID"
            }
        }

        var iconName: String {
            switch self {
            case .guest: return "person.crop.circle.badge.clock"
            case .email: return "envelope.fill"
            case .apple: return "apple.logo"
            }
        }
    }

    enum PasswordAuthFlow: String, Sendable, Identifiable {
        case signIn = "signIn"
        case signUp = "signUp"

        var id: String { rawValue }
    }

    enum AuthError: LocalizedError {
        case invalidEmail
        case passwordTooShort(minLength: Int)
        case invalidDisplayName
        case handleTaken
        case invalidCredentials
        case appleAuthFailed(String)
        case serverError(String)

        var errorDescription: String? {
            switch self {
            case .invalidEmail:
                return String(localized: "Please enter a valid email address.")
            case .passwordTooShort(let min):
                return String(localized: "Password must be at least \(min) characters.")
            case .invalidDisplayName:
                return String(localized: "Please enter a username between 2 and 20 characters.")
            case .handleTaken:
                return String(localized: "That username is already taken. Please try another.")
            case .invalidCredentials:
                return String(localized: "Could not sign in. Check your email and password.")
            case .appleAuthFailed(let msg):
                return msg
            case .serverError(let msg):
                return msg
            }
        }
    }

    private enum Keys {
        static let token = "convex_auth_token"
        static let refreshToken = "convex_refresh_token"
        static let userId = "durak_user_id"
        static let appleUserId = "durak_apple_user_id"
        static let appleEmail = "durak_apple_email"
        static let appleFullName = "durak_apple_full_name"
        static let accountKind = "durak_account_kind"
        static let userEmail = "durak_user_email"
        static let userHandle = "durak_user_handle"
        static let hasCompletedOnboarding = "durak_has_completed_auth_onboarding"
        static let legacyAppleUserId = "appleUserId"
        static let legacyAppleUserName = "appleUserName"
    }

    // MARK: - Observable State

    private(set) var currentUserId: String?
    var userId: String? { currentUserId }

    private(set) var isAuthenticated: Bool = false
    private(set) var accountKind: AccountKind = .guest
    private(set) var userEmail: String?
    private(set) var userHandle: String?
    private(set) var appleUserId: String?
    private(set) var isLoading: Bool = false

    /// Set after Apple sign-in when Apple/Keychain/guest name are all empty — UI should collect a display name once.
    private(set) var needsDisplayNamePrompt: Bool = false

    var displayName: String {
        get { PlayerNameStore.shared.name }
        set { PlayerNameStore.shared.name = newValue }
    }

    var isGuest: Bool {
        accountKind == .guest
    }

    var hasCompletedAuthOnboarding: Bool {
        didSet {
            UserDefaults.standard.set(hasCompletedAuthOnboarding, forKey: Keys.hasCompletedOnboarding)
        }
    }

    private init() {
        let defaults = UserDefaults.standard
        let storedToken = KeychainStore.shared.loadString(key: Keys.token)
        let storedAppleId = KeychainStore.shared.loadString(key: Keys.appleUserId)
            ?? defaults.string(forKey: Keys.legacyAppleUserId).flatMap { $0.isEmpty ? nil : $0 }

        self.currentUserId = KeychainStore.shared.loadString(key: Keys.userId)
        self.appleUserId = storedAppleId
        self.userEmail = defaults.string(forKey: Keys.userEmail)
        self.userHandle = defaults.string(forKey: Keys.userHandle)

        if let kindRaw = defaults.string(forKey: Keys.accountKind),
           let kind = AccountKind(rawValue: kindRaw) {
            self.accountKind = kind
        } else if let appleId = storedAppleId, !appleId.isEmpty {
            self.accountKind = .apple
        } else {
            self.accountKind = .guest
        }

        if defaults.object(forKey: Keys.hasCompletedOnboarding) != nil {
            self.hasCompletedAuthOnboarding = defaults.bool(forKey: Keys.hasCompletedOnboarding)
        } else {
            let hasExistingSession = (storedToken != nil) || (storedAppleId != nil)
            self.hasCompletedAuthOnboarding = hasExistingSession
        }

        self.isAuthenticated = (storedToken != nil) || (storedAppleId != nil)

        if let token = storedToken {
            Task {
                await ConvexHTTPClient.shared.setAuthToken(token)
                await refreshAccountStatusQuietly()
            }
        }
    }

    // MARK: - Persistence Helpers

    private func saveAccountMetadata(
        kind: AccountKind,
        email: String?,
        handle: String?,
        appleId: String? = nil
    ) {
        let defaults = UserDefaults.standard
        self.accountKind = kind
        defaults.set(kind.rawValue, forKey: Keys.accountKind)

        if let email, !email.isEmpty {
            self.userEmail = email
            defaults.set(email, forKey: Keys.userEmail)
        } else if kind == .guest {
            self.userEmail = nil
            defaults.removeObject(forKey: Keys.userEmail)
        }

        if let handle, !handle.isEmpty {
            self.userHandle = handle
            defaults.set(handle, forKey: Keys.userHandle)
        } else if kind == .guest {
            self.userHandle = nil
            defaults.removeObject(forKey: Keys.userHandle)
        }

        if let appleId, !appleId.isEmpty {
            self.appleUserId = appleId
            _ = KeychainStore.shared.save(key: Keys.appleUserId, string: appleId)
            defaults.set(appleId, forKey: Keys.legacyAppleUserId)
            defaults.set(PlayerNameStore.shared.name, forKey: Keys.legacyAppleUserName)
        } else if kind != .apple {
            self.appleUserId = nil
            _ = KeychainStore.shared.delete(key: Keys.appleUserId)
            defaults.removeObject(forKey: Keys.legacyAppleUserId)
            defaults.removeObject(forKey: Keys.legacyAppleUserName)
        }
    }

    /// Clears any cached credentials and resets the client's auth state.
    /// Also wipes identity-bound local data (display name, Apple name/email cache, wallet)
    /// so the next login cannot inherit the previous account's profile.
    func clearSession() {
        _ = KeychainStore.shared.delete(key: Keys.token)
        _ = KeychainStore.shared.delete(key: Keys.refreshToken)
        _ = KeychainStore.shared.delete(key: Keys.userId)
        _ = KeychainStore.shared.delete(key: Keys.appleUserId)
        _ = KeychainStore.shared.delete(key: Keys.appleEmail)
        _ = KeychainStore.shared.delete(key: Keys.appleFullName)

        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: Keys.accountKind)
        defaults.removeObject(forKey: Keys.userEmail)
        defaults.removeObject(forKey: Keys.userHandle)
        defaults.removeObject(forKey: Keys.legacyAppleUserId)
        defaults.removeObject(forKey: Keys.legacyAppleUserName)

        self.currentUserId = nil
        self.appleUserId = nil
        self.userEmail = nil
        self.userHandle = nil
        self.accountKind = .guest
        self.isAuthenticated = false
        self.needsDisplayNamePrompt = false

        PlayerNameStore.shared.name = "Player"
        EconomyStore.shared.resetToStartingBalances()

        Task {
            await ConvexHTTPClient.shared.setAuthToken(nil)
        }
    }

    // MARK: - 1. Proceed as Guest (Anonymous Session)

    /// Explicitly signs in as an anonymous guest and marks onboarding complete.
    func signInAsGuest() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            try await ensureAuthenticated()
            if accountKind != .apple && accountKind != .email {
                saveAccountMetadata(kind: .guest, email: nil, handle: nil)
            }
            isAuthenticated = true
            hasCompletedAuthOnboarding = true
        } catch {
            // Allow offline solo play as guest even if network is unreachable
            saveAccountMetadata(kind: .guest, email: nil, handle: nil)
            isAuthenticated = true
            hasCompletedAuthOnboarding = true
        }
    }

    /// Ensures the client has a valid Convex auth session (guest or existing).
    func ensureAuthenticated() async throws {
        // If we already have a token, check if it's set and not expired
        if let token = KeychainStore.shared.loadString(key: Keys.token) {
            if !isTokenExpired(token) {
                await ConvexHTTPClient.shared.setAuthToken(token)
                if self.currentUserId == nil, let sub = extractSubject(from: token) {
                    self.currentUserId = sub
                }
                self.isAuthenticated = true
                await ensureWallet()
                return
            }

            // Attempt token refresh if refresh token exists
            if let refresh = KeychainStore.shared.loadString(key: Keys.refreshToken) {
                do {
                    await ConvexHTTPClient.shared.setAuthToken(nil)
                    try await performSignIn(args: ["refreshToken": refresh])
                    self.isAuthenticated = true
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
        await ConvexHTTPClient.shared.setAuthToken(nil)

        // Mint anonymous guest session
        try await performSignIn(args: [
            "provider": "anonymous",
            "params": [:] as [String: String]
        ])
        if accountKind != .apple && accountKind != .email {
            saveAccountMetadata(kind: .guest, email: nil, handle: nil)
        }
        self.isAuthenticated = true
        await ensureWallet()
    }

    // MARK: - 2. Email & Password Sign In / Sign Up

    /// Authenticates with Convex using the `password` provider (`signIn` or `signUp`).
    /// Preserves and migrates any existing guest progress (wallet, profile, friendships).
    func signInWithPassword(
        email: String,
        password: String,
        flow: PasswordAuthFlow,
        name: String? = nil
    ) async throws {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard Self.isValidEmail(cleanEmail) else {
            throw AuthError.invalidEmail
        }
        guard password.count >= 8 else {
            throw AuthError.passwordTooShort(minLength: 8)
        }

        let cleanName = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        // Create Account requires an explicit username (2–20 chars). Never invent one from email.
        if flow == .signUp {
            guard cleanName.count >= 2, cleanName.count <= 20,
                  !Self.isPlaceholderDisplayName(cleanName) else {
                throw AuthError.invalidDisplayName
            }
        }

        isLoading = true
        defer { isLoading = false }

        let candidateHandle = flow == .signUp
            ? Self.sanitizeHandle(from: cleanName)
            : (cleanName.isEmpty ? nil : Self.sanitizeHandle(from: cleanName))

        // Capture guest upgrade token if currently signed in as guest
        var guestToken: String? = nil
        if isAuthenticated && accountKind == .guest {
            guestToken = await captureGuestUpgradeToken()
        }

        let params: [String: String] = [
            "email": cleanEmail,
            "password": password,
            "flow": flow.rawValue
        ]

        do {
            try await performSignIn(args: [
                "provider": "password",
                "params": params
            ])
        } catch {
            let msg = error.localizedDescription
            if msg.lowercased().contains("invalid") || msg.lowercased().contains("credentials") || msg.lowercased().contains("account") {
                throw AuthError.invalidCredentials
            }
            throw AuthError.serverError(
                flow == .signUp
                    ? String(localized: "Could not create account. This email may already be registered.")
                    : String(localized: "Could not sign in. Please check your email and password.")
            )
        }

        // Redeem guest migration token if we upgraded from a guest session
        if let guestToken {
            await redeemGuestUpgradeToken(guestToken)
        }

        // Update display name and Convex profile handle
        var resolvedHandle: String? = nil
        if flow == .signUp {
            PlayerNameStore.shared.name = cleanName
            if let handle = candidateHandle {
                resolvedHandle = await registerHandleBestEffort(handle)
            }
        } else if !cleanName.isEmpty {
            PlayerNameStore.shared.name = cleanName
        }

        // Sync account status & existing profile from Convex
        let profileInfo = await fetchAccountAndProfile()
        if let serverHandle = profileInfo.handle, !serverHandle.isEmpty {
            resolvedHandle = serverHandle
            if flow == .signIn && cleanName.isEmpty {
                PlayerNameStore.shared.name = serverHandle
            }
        }

        saveAccountMetadata(
            kind: .email,
            email: profileInfo.email ?? cleanEmail,
            handle: resolvedHandle
        )
        self.isAuthenticated = true
        self.hasCompletedAuthOnboarding = true

        await ensureWallet()
    }

    // MARK: - 3. Sign in with Apple ID

    /// Handles `ASAuthorizationAppleIDCredential` from Sign in with Apple, persists identity in Keychain,
    /// syncs display name to `PlayerNameStore`, and links/authenticates the account with Convex.
    ///
    /// Apple only returns `fullName` / `email` on the **first** authorization for this app.
    /// Subsequent logins rely on the Keychain cache — there is no API to re-fetch the Apple ID name.
    func signInWithApple(credential: ASAuthorizationAppleIDCredential) async throws {
        let appleId = credential.user
        let parsed = Self.parseAppleFullName(credential.fullName)
        let resolvedEmail = credential.email?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        try await signInWithAppleIdentity(
            userId: appleId,
            email: resolvedEmail,
            fullNameForCache: parsed.formattedFull,
            preferredDisplayName: parsed.givenName ?? parsed.formattedFull,
            identityToken: credential.identityToken
        )
    }

    /// Core Apple identity linker supporting both hardware `ASAuthorizationAppleIDCredential` and Simulator fallback.
    func signInWithAppleIdentity(
        userId appleId: String,
        email: String?,
        fullNameForCache: String?,
        preferredDisplayName: String? = nil,
        identityToken: Data? = nil
    ) async throws {
        isLoading = true
        defer { isLoading = false }

        // Apple only provides email and fullName on the very first authorization.
        // Cache them in Keychain so subsequent logins always retain them.
        if let email, !email.isEmpty {
            _ = KeychainStore.shared.save(key: Keys.appleEmail, string: email)
        }
        if let fullNameForCache, !fullNameForCache.isEmpty {
            _ = KeychainStore.shared.save(key: Keys.appleFullName, string: fullNameForCache)
            UserDefaults.standard.set(fullNameForCache, forKey: Keys.legacyAppleUserName)
        }

        let cachedEmail = email ?? KeychainStore.shared.loadString(key: Keys.appleEmail)
        let cachedFullName = KeychainStore.shared.loadString(key: Keys.appleFullName)
            ?? UserDefaults.standard.string(forKey: Keys.legacyAppleUserName)

        let resolvedDisplay = Self.resolveAppleDisplayName(
            preferredDisplayName: preferredDisplayName,
            cachedFullName: cachedFullName
        )

        if let resolvedDisplay {
            PlayerNameStore.shared.name = resolvedDisplay
            needsDisplayNamePrompt = false
        } else {
            // Do not invent "Apple Player" — ask the UI for a one-shot display name.
            needsDisplayNamePrompt = true
        }

        // Capture guest upgrade token if upgrading from an anonymous guest session
        var guestToken: String? = nil
        if isAuthenticated && accountKind == .guest {
            guestToken = await captureGuestUpgradeToken()
        }

        // Derive deterministic Convex credentials for this Apple ID so the user gets
        // a full registered Convex account with cloud wallet & handle backup.
        let syntheticEmail = cachedEmail ?? Self.syntheticAppleEmail(for: appleId)
        let derivedPassword = Self.derivedAppleCredentialSecret(for: appleId)

        var convexLinked = false
        do {
            // Try signing in to existing Apple-linked Convex account first
            try await performSignIn(args: [
                "provider": "password",
                "params": [
                    "email": syntheticEmail,
                    "password": derivedPassword,
                    "flow": PasswordAuthFlow.signIn.rawValue
                ]
            ])
            convexLinked = true
        } catch {
            // First time this Apple ID is linking with Convex — create the account
            do {
                try await performSignIn(args: [
                    "provider": "password",
                    "params": [
                        "email": syntheticEmail,
                        "password": derivedPassword,
                        "flow": PasswordAuthFlow.signUp.rawValue
                    ]
                ])
                convexLinked = true
            } catch {
                NSLog("[ConvexAuth] Apple Convex link fallback (continuing with local Apple session): %@", error.localizedDescription)
            }
        }

        var resolvedHandle: String? = userHandle
        if convexLinked {
            if let guestToken {
                await redeemGuestUpgradeToken(guestToken)
            }
            if !needsDisplayNamePrompt,
               let candidate = Self.sanitizeHandle(from: PlayerNameStore.shared.name) {
                if let registered = await registerHandleBestEffort(candidate) {
                    resolvedHandle = registered
                }
            }
            let info = await fetchAccountAndProfile()
            if let h = info.handle {
                resolvedHandle = h
            }
            await ensureWallet()
        }

        saveAccountMetadata(
            kind: .apple,
            email: cachedEmail ?? syntheticEmail,
            handle: resolvedHandle,
            appleId: appleId
        )
        self.isAuthenticated = true
        // Hold onboarding complete until the user picks a name when Apple gave none.
        self.hasCompletedAuthOnboarding = !needsDisplayNamePrompt
    }

    /// Graceful fallback for iOS Simulator or unsigned local development builds where
    /// iCloud / Sign in with Apple entitlement isn't provisioned on the host machine.
    func signInWithAppleSimulatorFallback() async throws {
        let existingAppleId = KeychainStore.shared.loadString(key: Keys.appleUserId)
            ?? "apple.sim.\(UUID().uuidString.prefix(12).lowercased())"
        let currentName = PlayerNameStore.shared.name
        let meaningful = Self.isPlaceholderDisplayName(currentName) ? nil : currentName
        try await signInWithAppleIdentity(
            userId: existingAppleId,
            email: KeychainStore.shared.loadString(key: Keys.appleEmail),
            fullNameForCache: meaningful,
            preferredDisplayName: meaningful
        )
    }

    /// Completes the one-shot display-name prompt after Apple sign-in with no usable name.
    func completeDisplayNamePrompt(_ rawName: String) async throws {
        let trimmed = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2, trimmed.count <= 20 else {
            throw AuthError.invalidDisplayName
        }
        PlayerNameStore.shared.name = trimmed
        if accountKind == .apple {
            _ = KeychainStore.shared.save(key: Keys.appleFullName, string: trimmed)
            UserDefaults.standard.set(trimmed, forKey: Keys.legacyAppleUserName)
        }
        if !isGuest, let candidate = Self.sanitizeHandle(from: trimmed) {
            if let updated = await registerHandleBestEffort(candidate) {
                self.userHandle = updated
                UserDefaults.standard.set(updated, forKey: Keys.userHandle)
            }
        }
        needsDisplayNamePrompt = false
        hasCompletedAuthOnboarding = true
    }

    // MARK: - 4. Sign Out & Delete Account

    /// Signs out of the current account, clears persisted tokens, and optionally mints a fresh guest session.
    func signOut(mintFreshGuest: Bool = false) async {
        isLoading = true
        defer { isLoading = false }

        let _: EmptyResponse? = try? await ConvexHTTPClient.shared.action("auth:signOut", args: [:])
        clearSession()

        if mintFreshGuest {
            try? await signInAsGuest()
        } else {
            hasCompletedAuthOnboarding = false
        }
    }

    /// Permanently deletes the current user's account on Convex and signs out.
    func deleteAccount() async throws {
        isLoading = true
        defer { isLoading = false }

        struct DeleteResult: Decodable {
            let deleted: Bool?
        }
        let _: DeleteResult? = try? await ConvexHTTPClient.shared.mutation("account:deleteAccount", args: [:])
        clearSession()
        hasCompletedAuthOnboarding = false
    }

    // MARK: - Wallet & Profile Sync

    /// True when Convex has a session that can mutate wallets (guest or signed-in).
    var hasWalletSession: Bool {
        isAuthenticated
    }

    func ensureWallet() async {
        struct WalletResult: Decodable {
            let creditBalance: Double?
            let goldBalance: Double?
        }
        let args: [String: Any] = [
            "localGoldBalance": EconomyStore.shared.gold,
            "localCreditBalance": EconomyStore.shared.credits
        ]
        if let res: WalletResult = try? await ConvexHTTPClient.shared.mutation("wallets:ensureWallet", args: args) {
            // Server wallet is source of truth for the signed-in account.
            EconomyStore.shared.syncFromServer(
                gold: res.goldBalance.map { Int($0) },
                credits: res.creditBalance.map { Int($0) }
            )
        }
    }

    /// Refresh wallet from Convex into `EconomyStore` (Settings / post-match).
    func refreshWallet() async {
        await ensureWallet()
    }

    /// Deduct credits on the server; syncs `EconomyStore` on success.
    @discardableResult
    func spendCredits(amount: Int, reason: String) async throws -> Int {
        struct CreditResult: Decodable {
            let creditBalance: Double
        }
        let res: CreditResult = try await ConvexHTTPClient.shared.mutation(
            "wallets:spendCredits",
            args: ["amount": amount, "reason": reason]
        )
        let balance = max(0, Int(res.creditBalance))
        EconomyStore.shared.syncFromServer(gold: nil, credits: balance)
        return balance
    }

    /// Deduct gold on the server; syncs `EconomyStore` on success.
    @discardableResult
    func spendGold(amount: Int, reason: String) async throws -> Int {
        struct GoldResult: Decodable {
            let goldBalance: Double
        }
        let res: GoldResult = try await ConvexHTTPClient.shared.mutation(
            "wallets:spendGold",
            args: ["amount": amount, "reason": reason]
        )
        let balance = max(0, Int(res.goldBalance))
        EconomyStore.shared.syncFromServer(gold: balance, credits: nil)
        return balance
    }

    /// Award credits on the server; syncs `EconomyStore` on success.
    @discardableResult
    func awardCredits(amount: Int, reason: String) async throws -> Int {
        struct CreditResult: Decodable {
            let creditBalance: Double
        }
        let res: CreditResult = try await ConvexHTTPClient.shared.mutation(
            "wallets:awardCreditsPublic",
            args: ["amount": amount, "reason": reason]
        )
        let balance = max(0, Int(res.creditBalance))
        EconomyStore.shared.syncFromServer(gold: nil, credits: balance)
        return balance
    }

    func updateDisplayName(_ newName: String) async {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        PlayerNameStore.shared.name = trimmed
        if accountKind == .apple {
            _ = KeychainStore.shared.save(key: Keys.appleFullName, string: trimmed)
            UserDefaults.standard.set(trimmed, forKey: Keys.legacyAppleUserName)
        }
        if !isGuest, let candidate = Self.sanitizeHandle(from: trimmed) {
            if let updated = await registerHandleBestEffort(candidate) {
                self.userHandle = updated
                UserDefaults.standard.set(updated, forKey: Keys.userHandle)
            }
        }
    }

    // MARK: - Private Convex Helpers

    private func captureGuestUpgradeToken() async -> String? {
        struct UpgradeTokenResult: Decodable {
            let token: String
        }
        let res: UpgradeTokenResult? = try? await ConvexHTTPClient.shared.mutation("account:beginGuestUpgrade", args: [:])
        return res?.token
    }

    private func redeemGuestUpgradeToken(_ token: String) async {
        struct CompleteUpgradeResult: Decodable {
            let migrated: Bool
        }
        for _ in 0..<3 {
            if let res: CompleteUpgradeResult = try? await ConvexHTTPClient.shared.mutation(
                "account:completeGuestUpgrade",
                args: ["token": token]
            ), res.migrated {
                return
            }
            try? await Task.sleep(for: .milliseconds(350))
        }
    }

    private func registerHandleBestEffort(_ handle: String) async -> String? {
        struct SetHandleResult: Decodable {
            let handle: String
        }
        if let res: SetHandleResult = try? await ConvexHTTPClient.shared.mutation(
            "profiles:setHandle",
            args: ["handle": handle]
        ) {
            return res.handle
        }
        // If the exact handle is taken, append a short suffix
        let suffixed = String(handle.prefix(15)) + "_" + String(Int.random(in: 100...999))
        if let res: SetHandleResult = try? await ConvexHTTPClient.shared.mutation(
            "profiles:setHandle",
            args: ["handle": suffixed]
        ) {
            return res.handle
        }
        return nil
    }

    private func fetchAccountAndProfile() async -> (isAnonymous: Bool, email: String?, handle: String?) {
        struct AccountStatus: Decodable {
            let userId: String?
            let isAnonymous: Bool
            let email: String?
        }
        struct ProfileResult: Decodable {
            let userId: String?
            let handle: String?
        }

        let status: AccountStatus? = try? await ConvexHTTPClient.shared.query("account:getAccountStatus", args: [:])
        let profile: ProfileResult? = try? await ConvexHTTPClient.shared.query("profiles:getMyProfile", args: [:])
        return (
            isAnonymous: status?.isAnonymous ?? (accountKind == .guest),
            email: status?.email,
            handle: profile?.handle
        )
    }

    private func refreshAccountStatusQuietly() async {
        let info = await fetchAccountAndProfile()
        if let handle = info.handle, !handle.isEmpty {
            self.userHandle = handle
            UserDefaults.standard.set(handle, forKey: Keys.userHandle)
        }
        if let email = info.email, !email.isEmpty {
            self.userEmail = email
            UserDefaults.standard.set(email, forKey: Keys.userEmail)
            if self.accountKind == .guest && !info.isAnonymous {
                self.accountKind = (self.appleUserId != nil) ? .apple : .email
                UserDefaults.standard.set(self.accountKind.rawValue, forKey: Keys.accountKind)
            }
        }
    }

    private func performSignIn(args: [String: Any]) async throws {
        struct SignInResult: Decodable {
            struct Tokens: Decodable {
                let token: String
                let refreshToken: String
            }
            let tokens: Tokens?
        }

        let res: SignInResult = try await ConvexHTTPClient.shared.action("auth:signIn", args: args)
        guard let tokens = res.tokens else {
            throw ConvexHTTPClient.ConvexError.serverError("No tokens returned from auth:signIn")
        }

        _ = KeychainStore.shared.save(key: Keys.token, string: tokens.token)
        _ = KeychainStore.shared.save(key: Keys.refreshToken, string: tokens.refreshToken)
        await ConvexHTTPClient.shared.setAuthToken(tokens.token)

        if let sub = extractSubject(from: tokens.token) {
            self.currentUserId = sub
            _ = KeychainStore.shared.save(key: Keys.userId, string: sub)
        }
    }

    // MARK: - Validation & Crypto Utilities

    static func isValidEmail(_ email: String) -> Bool {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = trimmed.split(separator: "@")
        guard parts.count == 2,
              !parts[0].isEmpty,
              parts[1].contains("."),
              !parts[1].hasPrefix("."),
              !parts[1].hasSuffix(".") else {
            return false
        }
        return !trimmed.contains(" ")
    }

    /// Placeholder / invented names that should not survive Apple sign-in when a real name is available.
    static func isPlaceholderDisplayName(_ name: String) -> Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return true }
        let lowered = trimmed.lowercased()
        return lowered == "player" || lowered == "apple player"
    }

    /// Parses Apple's `PersonNameComponents` into a given-name (for in-game display) and a formatted full name (for Keychain).
    static func parseAppleFullName(_ components: PersonNameComponents?) -> (givenName: String?, formattedFull: String?) {
        guard let components else { return (nil, nil) }

        let given = components.givenName?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let givenName = (given?.isEmpty == false) ? given : nil

        let formatter = PersonNameComponentsFormatter()
        formatter.style = .default
        let formatted = formatter.string(from: components)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let formattedFull = formatted.isEmpty ? nil : formatted

        // If the formatter produced nothing but given/family exist, join manually.
        if formattedFull == nil {
            let parts = [components.givenName, components.familyName]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if !parts.isEmpty {
                return (givenName, parts.joined(separator: " "))
            }
        }
        return (givenName, formattedFull)
    }

    /// Fallback order: fresh preferred display → Keychain full name for this Apple session.
    /// Does not fall back to PlayerNameStore — that would leak the previous account's name after logout.
    static func resolveAppleDisplayName(
        preferredDisplayName: String?,
        cachedFullName: String?
    ) -> String? {
        if let preferred = preferredDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !preferred.isEmpty,
           !isPlaceholderDisplayName(preferred) {
            return preferred
        }
        if let cached = cachedFullName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !cached.isEmpty,
           !isPlaceholderDisplayName(cached) {
            return cached
        }
        return nil
    }

    static func sanitizeHandle(from raw: String) -> String? {
        let cleaned = raw
            .lowercased()
            .replacingOccurrences(of: " ", with: "_")
            .filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_") }
        guard !cleaned.isEmpty else { return nil }
        if cleaned.count < 3 {
            return (cleaned + "_player").prefix(20).description
        }
        return String(cleaned.prefix(20))
    }

    private static func syntheticAppleEmail(for appleUserId: String) -> String {
        let digest = SHA256.hash(data: Data(appleUserId.utf8))
        let hex = digest.prefix(10).map { String(format: "%02x", $0) }.joined()
        return "apple_\(hex)@appleid.durak.app"
    }

    private static func derivedAppleCredentialSecret(for appleUserId: String) -> String {
        let input = "com.qaschoolusa.durak.apple.auth.v1:\(appleUserId)"
        let digest = SHA256.hash(data: Data(input.utf8))
        let hex = digest.prefix(20).map { String(format: "%02x", $0) }.joined()
        return "Ap!\(hex)9"
    }

    // MARK: - JWT Parsing

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
