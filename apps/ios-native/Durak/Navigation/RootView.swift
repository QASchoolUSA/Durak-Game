import SwiftUI
import DurakGameCore

/// Root view that switches between screens based on the app router.
struct RootView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme
    @State private var gameVM = GameViewModel()

    var body: some View {
        ZStack {
            // App-wide dynamic background that smoothly morphs across all screens when theme changes
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 0.4), value: theme.activeAppearanceId)

            switch router.current {
            case .boot:
                BootView()

            case .welcome:
                WelcomeView()

            case .home:
                HomeView()
                    .environment(gameVM)

            case .lobby:
                LobbyView()
                    .environment(gameVM)

            case .game:
                GameView()
                    .environment(gameVM)

            case .result:
                ResultView()
                    .environment(gameVM)
            }

            if router.isJoiningInvite {
                joiningInviteOverlay
            }
        }
        .statusBarHidden(true)
        .animation(.interactiveSpring(response: 0.24, dampingFraction: 0.84), value: router.current)
        .sheet(isPresented: Binding(
            get: { router.settingsPresented },
            set: { router.settingsPresented = $0 }
        )) {
            SettingsView()
                .environment(gameVM)
                .environment(theme)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: Binding(
            get: { router.rulesPresented },
            set: { router.rulesPresented = $0 }
        )) {
            RulesView()
                .environment(theme)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
#if DEBUG
        .onAppear {
            let args = ProcessInfo.processInfo.arguments
            if let themeIdx = args.firstIndex(of: "-theme"), themeIdx + 1 < args.count,
               let id = AppearanceId(rawValue: args[themeIdx + 1]) {
                theme.activeAppearanceId = id
            }

            if args.contains("-sixPlayers") {
                gameVM.numPlayers = 6
            }
            if args.contains("-resetAuth") {
                ConvexAuth.shared.clearSession()
                ConvexAuth.shared.hasCompletedAuthOnboarding = false
                PlayerNameStore.shared.name = "Player"
                _ = KeychainStore.shared.delete(key: "durak_apple_full_name")
                _ = KeychainStore.shared.delete(key: "durak_apple_email")
                UserDefaults.standard.removeObject(forKey: "appleUserName")
            }
            if args.contains("-demoAppleAccount") {
                Task {
                    try? await ConvexAuth.shared.signInWithAppleSimulatorFallback()
                    if ConvexAuth.shared.needsDisplayNamePrompt {
                        router.navigate(to: .welcome)
                    }
                }
            }
            if args.contains("-showWelcome") || args.contains("-showAuthSheet") || args.contains("-showSignInSheet") {
                router.navigate(to: .welcome)
            } else if args.contains("-showHome") || args.contains("-showConfig") || args.contains("-showJoin") {
                ConvexAuth.shared.hasCompletedAuthOnboarding = true
                router.navigate(to: .home)
                if args.contains("-showJoin") {
                    router.joinSheetPresented = true
                }
            } else if args.contains("-startSoloGame") {
                gameVM.startSoloGame()
                if args.contains("-demoTable") {
                    if let g = gameVM.game, let firstCard = (g.hands[g.attackerId] ?? []).first {
                        if let next = try? applyMove(g, .attack(player: g.attackerId, card: firstCard)) {
                            gameVM.game = next
                        }
                    }
                }
                if args.contains("-demoLastCard") {
                    if var g = gameVM.game {
                        g.deck = [g.trumpCard]
                        gameVM.game = g
                    }
                    // Freeze bots so the solo trump stays on-screen for layout screenshots.
                    gameVM.debugCancelAI()
                }
                router.navigate(to: .game)
            } else if args.contains("-showLobby") {
                gameVM.onlineRoomCode = "791371"
                gameVM.onlineRoomId = "test-room-id"
                gameVM.onlineIsHost = true
                gameVM.playMode = .online
                router.navigate(to: .lobby)
            } else if args.contains("-showSettings") {
                router.navigate(to: .home)
                router.settingsPresented = true
            } else if args.contains("-showRules") {
                router.navigate(to: .home)
                router.rulesPresented = true
            } else if args.contains("-showConfig") || args.contains("-showJoin") {
                router.navigate(to: .home)
            } else if args.contains("-showResult") {
                gameVM.startSoloGame()
                gameVM.forfeit()
                router.navigate(to: .result)
            }
        }
#endif
        .onOpenURL { url in
            if InviteLinks.roomCode(from: url) != nil {
                router.handleInviteURL(url)
                Task { await processPendingInviteIfReady() }
                return
            }
            if url.host == "welcome" {
                router.navigate(to: .welcome)
            } else if url.host == "game" {
                gameVM.startSoloGame()
                router.navigate(to: .game)
            } else if url.host == "result" {
                if gameVM.game == nil {
                    gameVM.startSoloGame()
                }
                router.navigate(to: .result)
            } else if url.host == "lobby" {
                router.navigate(to: .lobby)
            } else if url.host == "home" {
                router.navigate(to: .home)
            } else if url.host == "settings" {
                router.settingsPresented = true
            } else if url.host == "rules" {
                router.rulesPresented = true
            } else if url.host == "theme" {
                let themeParam = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                if let id = AppearanceId(rawValue: themeParam) {
                    withAnimation(.easeInOut(duration: 0.35)) {
                        theme.activeAppearanceId = id
                    }
                }
            }
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            guard let url = activity.webpageURL else { return }
            router.handleInviteURL(url)
            Task { await processPendingInviteIfReady() }
        }
        .onChange(of: router.current) { _, screen in
            if screen == .home || screen == .lobby || screen == .result {
                Task { await processPendingInviteIfReady() }
            }
        }
        .onChange(of: router.pendingInviteCode) { _, code in
            guard code != nil else { return }
            Task { await processPendingInviteIfReady() }
        }
    }

    private var joiningInviteOverlay: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .tint(theme.ui.accent)
                    .scaleEffect(1.15)
                Text("Joining match…")
                    .font(DesignTokens.Typography.heading)
                    .foregroundStyle(DesignTokens.Colors.textLight)
            }
            .padding(28)
            .background(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                    .fill(theme.ui.surfaceGlass)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                            .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                    )
            )
        }
        .transition(.opacity)
    }

    /// Auto-joins when onboarded with a display name; otherwise falls back to the join sheet.
    @MainActor
    private func processPendingInviteIfReady() async {
        guard let code = router.pendingInviteCode else { return }
        guard !router.isJoiningInvite else { return }

        // Wait until boot finishes; keep the invite for after onboarding.
        if router.current == .boot {
            return
        }

        if router.current == .welcome || !ConvexAuth.shared.hasCompletedAuthOnboarding {
            // Stay on welcome; after onboarding lands on home, onChange will retry.
            return
        }

        let displayName = PlayerNameStore.shared.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if displayName.isEmpty || ConvexAuth.shared.needsDisplayNamePrompt {
            presentJoinSheetFallback(code: code)
            return
        }

        router.isJoiningInvite = true
        defer { router.isJoiningInvite = false }

        do {
            try await ConvexAuth.shared.ensureAuthenticated()
            let res = try await OnlineBridge.shared.joinRoom(code: code, displayName: displayName)
            gameVM.onlineRoomId = res.roomId
            gameVM.onlineRoomCode = InviteLinks.normalizeRoomCode(code)
            gameVM.onlineDisplayName = displayName
            gameVM.onlineIsHost = false
            gameVM.playMode = .online
            router.pendingInviteCode = nil
            router.pendingJoinCode = nil
            router.joinSheetPresented = false
            router.navigate(to: .lobby)
            FeedbackManager.shared.trigger(.confirm)
        } catch {
            presentJoinSheetFallback(code: code)
            FeedbackManager.shared.trigger(.failure)
        }
    }

    @MainActor
    private func presentJoinSheetFallback(code: String) {
        router.pendingInviteCode = nil
        router.pendingJoinCode = code
        if router.current != .home && router.current != .lobby {
            router.navigate(to: .home)
        }
        router.joinSheetPresented = true
    }
}

// MARK: - Equatable conformance for animation

extension AppRouter.Screen: Equatable {}
