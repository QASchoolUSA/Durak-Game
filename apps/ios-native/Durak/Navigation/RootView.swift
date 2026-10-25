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
        }
        .animation(.easeInOut(duration: 0.3), value: router.current)
        .sheet(isPresented: Binding(
            get: { router.settingsPresented },
            set: { router.settingsPresented = $0 }
        )) {
            SettingsView()
                .environment(gameVM)
                .environment(theme)
        }
        .sheet(isPresented: Binding(
            get: { router.rulesPresented },
            set: { router.rulesPresented = $0 }
        )) {
            RulesView()
                .environment(theme)
        }
#if DEBUG
        .onAppear {
            let args = ProcessInfo.processInfo.arguments
            if let themeIdx = args.firstIndex(of: "-theme"), themeIdx + 1 < args.count,
               let id = AppearanceId(rawValue: args[themeIdx + 1]) {
                theme.activeAppearanceId = id
            }

            if args.contains("-startSoloGame") {
                gameVM.startSoloGame()
                router.navigate(to: .game)
            } else if args.contains("-showLobby") {
                gameVM.onlineRoomCode = "791371"
                gameVM.onlineRoomId = "test-room-id"
                gameVM.onlineIsHost = true
                gameVM.playMode = .online
                router.navigate(to: .lobby)
            } else if args.contains("-showSettings") {
                router.settingsPresented = true
            } else if args.contains("-showRules") {
                router.rulesPresented = true
            } else if args.contains("-showResult") {
                gameVM.startSoloGame()
                gameVM.forfeit()
                router.navigate(to: .result)
            }
        }
#endif
        .onOpenURL { url in
            if url.host == "game" {
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
    }
}

// MARK: - Equatable conformance for animation

extension AppRouter.Screen: Equatable {}
