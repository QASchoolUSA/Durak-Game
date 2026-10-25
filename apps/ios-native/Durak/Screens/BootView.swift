import SwiftUI

/// Boot / splash screen shown while the app loads.
struct BootView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme

    @State private var opacity: Double = 0

    var body: some View {
        ZStack {
            // Background gradient matching active theme
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: DesignTokens.Spacing.lg) {
                Text("ДУРАК")
                    .font(DesignTokens.Typography.hero)
                    .foregroundStyle(
                        LinearGradient(
                            colors: theme.ui.accentGradient,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .tracking(8)

                ProgressView()
                    .tint(theme.ui.accent)
                    .scaleEffect(1.2)
            }
            .opacity(opacity)
        }
        .onAppear {
            withAnimation(.easeIn(duration: 0.5)) {
                opacity = 1
            }
            // Authenticate and load initial preferences
            Task {
                try? await ConvexAuth.shared.ensureAuthenticated()
                try? await Task.sleep(for: .seconds(1.2))
                await MainActor.run {
                    withAnimation {
                        if router.current == .boot {
                            router.navigate(to: .home)
                        }
                    }
                }
            }
        }
    }
}
