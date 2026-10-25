import SwiftUI

/// Welcome / onboarding screen for first-run.
struct WelcomeView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme

    var body: some View {
        ZStack {
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: DesignTokens.Spacing.xxl) {
                Spacer()

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

                Text("Welcome to Durak — the classic Russian card game.")
                    .font(DesignTokens.Typography.body)
                    .foregroundStyle(DesignTokens.Colors.textLight)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, DesignTokens.Spacing.xxl)

                Spacer()

                Button {
                    router.navigate(to: .home)
                } label: {
                    Text("GET STARTED")
                        .font(DesignTokens.Typography.heading)
                        .tracking(2)
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
                        .shadow(color: theme.ui.accent.opacity(0.4), radius: 10, y: 3)
                }
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.xxl)
            }
        }
    }
}
