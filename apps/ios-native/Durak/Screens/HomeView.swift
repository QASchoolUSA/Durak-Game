import SwiftUI

/// Home screen — main menu with PLAY and JOIN buttons.
///
/// Port of `HomeScreen.tsx` + `HomeHero.tsx`.
struct HomeView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme
    @Environment(GameViewModel.self) private var gameVM

    @State private var showGameConfig = false
    @State private var showJoinSheet = false
    @State private var heroScale: CGFloat = 0.8
    @State private var heroOpacity: Double = 0

    var body: some View {
        ZStack {
            // Background
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Decorative elements
            Circle()
                .stroke(theme.ui.accent.opacity(0.18), lineWidth: 1)
                .frame(width: 300, height: 300)
                .offset(y: -60)

            Circle()
                .stroke(theme.ui.accent.opacity(0.08), lineWidth: 1)
                .frame(width: 420, height: 420)
                .offset(y: -60)

            VStack(spacing: DesignTokens.Spacing.xxl) {
                Spacer()

                // Hero title
                VStack(spacing: DesignTokens.Spacing.sm) {
                    Text("ДУРАК")
                        .font(DesignTokens.Typography.hero)
                        .foregroundStyle(
                            LinearGradient(
                                colors: theme.ui.accentGradient,
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .tracking(8)
                        .shadow(color: theme.ui.accent.opacity(0.4), radius: 20)

                    Text("CARD GAME")
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.textMuted)
                        .tracking(4)
                }
                .scaleEffect(heroScale)
                .opacity(heroOpacity)

                Spacer()

                // Action buttons
                VStack(spacing: DesignTokens.Spacing.md) {
                    Button {
                        showGameConfig = true
                    } label: {
                        Text("PLAY")
                            .font(DesignTokens.Typography.title)
                            .tracking(3)
                            .foregroundStyle(theme.ui.accentText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, DesignTokens.Spacing.md)
                            .background(
                                LinearGradient(
                                    colors: theme.ui.accentGradient,
                                    startPoint: .leading,
                                    endPoint: .trailing
                                ),
                                in: RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                            )
                            .goldenShimmer()
                            .shadow(color: theme.ui.accent.opacity(0.45), radius: 12, y: 4)
                    }
                    .buttonStyle(.springPressable(feedback: .confirm))

                    Button {
                        showJoinSheet = true
                    } label: {
                        Text("JOIN GAME")
                            .font(DesignTokens.Typography.heading)
                            .tracking(1)
                            .foregroundStyle(theme.ui.accent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, DesignTokens.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                    .stroke(theme.ui.accent.opacity(0.35), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.springPressable(feedback: .uiTap))
                }
                .padding(.horizontal, DesignTokens.Spacing.xxl)

                // Bottom bar
                HStack {
                    Button {
                        router.settingsPresented = true
                    } label: {
                        Image(systemName: "gearshape.fill")
                            .font(.title2)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                    }
                    .buttonStyle(.springPressable(feedback: .uiTap))

                    Spacer()

                    Button {
                        router.rulesPresented = true
                    } label: {
                        Image(systemName: "book.fill")
                            .font(.title2)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                    }
                    .buttonStyle(.springPressable(feedback: .uiTap))
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.bottom, DesignTokens.Spacing.lg)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.7)) {
                heroScale = 1.0
                heroOpacity = 1.0
            }
#if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-showConfig") {
                showGameConfig = true
            } else if args.contains("-showJoin") {
                showJoinSheet = true
            }
#endif
        }
        .sheet(isPresented: $showGameConfig) {
            GameConfigSheet()
                .environment(gameVM)
                .environment(theme)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showJoinSheet) {
            JoinGameSheet()
                .environment(gameVM)
                .environment(theme)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }
}
