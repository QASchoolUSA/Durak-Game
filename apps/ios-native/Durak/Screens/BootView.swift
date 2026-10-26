import SwiftUI

/// Sleek, Apple-grade animated splash screen shown during app launch.
struct BootView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme

    @State private var appeared = false
    @State private var ringScale: CGFloat = 0.85
    @State private var progressFraction: CGFloat = 0.15

    var body: some View {
        GeometryReader { proxy in
            let isWide = DesignTokens.Layout.isPadOrMac
            let isLandscape = proxy.size.width > proxy.size.height
            let heroMultiplier: CGFloat = isWide ? (isLandscape ? 1.16 : 1.28) : 1.0

            ZStack {
                // 1. Deep multi-stop atmospheric felt backdrop
                LinearGradient(
                    colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                // Subtle radial spotlight behind the crest
                RadialGradient(
                    colors: [
                        theme.ui.accent.opacity(0.20),
                        theme.ui.accent.opacity(0.04),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 10,
                    endRadius: 280 * heroMultiplier
                )
                .ignoresSafeArea()

                // Concentric ornamental rings
                ZStack {
                    Circle()
                        .stroke(theme.ui.accent.opacity(0.10), lineWidth: 1)
                        .frame(width: 320 * heroMultiplier, height: 320 * heroMultiplier)
                        .scaleEffect(ringScale)

                    Circle()
                        .stroke(theme.ui.accent.opacity(0.16), lineWidth: 1)
                        .frame(width: 248 * heroMultiplier, height: 248 * heroMultiplier)
                        .scaleEffect(2.0 - ringScale * 0.95)
                }
                .offset(y: -48 * heroMultiplier)

                // 2. Central Hero Crest + Typography + Sleek Progress Track
                VStack(spacing: DesignTokens.Spacing.xl) {
                    Spacer()

                    VStack(spacing: 0) {
                        VStack(spacing: 18 * heroMultiplier) {
                            // Jester Fool Emblem positioned well above the 5-card fan
                            Image("JesterFool")
                                .resizable()
                                .scaledToFit()
                                .frame(width: 120 * heroMultiplier, height: 120 * heroMultiplier)
                                .shadow(color: Color.black.opacity(0.42), radius: 18, y: 8)

                            // Fanned playing cards — lifted; spacer below clears brand title
                            HomeCardFanView(
                                cardPalette: theme.cardPalette,
                                accent: theme.ui.accent,
                                reduceMotion: false,
                                cardWidth: round(54 * heroMultiplier),
                                cardHeight: round(76 * heroMultiplier),
                                spreadScale: heroMultiplier
                            )
                            .frame(height: 86 * heroMultiplier)
                            .offset(y: -10 * heroMultiplier)
                        }
                        .frame(height: 220 * heroMultiplier)

                        Color.clear.frame(height: 36)

                        // Brand Wordmark + Ornamental Rule
                        VStack(spacing: DesignTokens.Spacing.xs) {
                            Text("DURAK")
                                .font(DesignTokens.Typography.hero)
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: theme.ui.accentGradient,
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .tracking(isWide ? 10 : 8)
                                .goldenShimmer()
                                .shadow(color: theme.ui.accent.opacity(0.45), radius: 18)

                            HStack(spacing: 10) {
                                Capsule()
                                    .fill(theme.ui.accent.opacity(0.65))
                                    .frame(width: 44 * heroMultiplier, height: 1.5)
                                Rectangle()
                                    .fill(theme.ui.accent)
                                    .frame(width: 6 * heroMultiplier, height: 6 * heroMultiplier)
                                    .rotationEffect(.degrees(45))
                                Capsule()
                                    .fill(theme.ui.accent.opacity(0.65))
                                    .frame(width: 44 * heroMultiplier, height: 1.5)
                            }
                            .padding(.vertical, 2)

                            Text("ROYAL CARD GAME")
                                .font(DesignTokens.Typography.captionSmall)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                                .tracking(4.5)
                        }
                    }
                    .scaleEffect(appeared ? 1.0 : 0.90)
                    .opacity(appeared ? 1.0 : 0.0)

                    Spacer()

                    // 3. Sleek luminous loading bar + suit pips at bottom
                    VStack(spacing: 14) {
                        HStack(spacing: 16) {
                            ForEach(["♠", "♥", "♦", "♣"], id: \.self) { suit in
                                Text(suit)
                                    .font(.system(size: isWide ? 15 : 13, weight: .bold))
                                    .foregroundStyle(
                                        (suit == "♥" || suit == "♦")
                                            ? DesignTokens.Colors.redCard.opacity(0.85)
                                            : theme.ui.accent.opacity(0.75)
                                    )
                            }
                        }

                        // Minimalist Apple-style capsule progress bar
                        let trackWidth: CGFloat = isWide ? 196 : 148
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.10))
                                .frame(width: trackWidth, height: 4)

                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: theme.ui.accentGradient,
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: trackWidth * progressFraction, height: 4)
                                .shadow(color: theme.ui.accent.opacity(0.6), radius: 6)
                        }
                    }
                    .opacity(appeared ? 1.0 : 0.0)
                    .padding(.bottom, DesignTokens.Spacing.xxl)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear {
            FeedbackManager.shared.warmUp()
            withAnimation(.spring(response: 0.55, dampingFraction: 0.78)) {
                appeared = true
                ringScale = 1.0
            }
            withAnimation(.easeInOut(duration: 0.48)) {
                progressFraction = 1.0
            }
            // Warm auth in the background only if the user already completed onboarding
            if ConvexAuth.shared.hasCompletedAuthOnboarding {
                Task {
                    try? await ConvexAuth.shared.ensureAuthenticated()
                }
            }
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(520))
#if DEBUG
                if ProcessInfo.processInfo.arguments.contains("-holdBoot") {
                    return
                }
#endif
                if router.current == .boot {
                    if ConvexAuth.shared.hasCompletedAuthOnboarding {
                        router.navigate(to: .home)
                    } else {
                        router.navigate(to: .welcome)
                    }
                }
            }
        }
    }
}
