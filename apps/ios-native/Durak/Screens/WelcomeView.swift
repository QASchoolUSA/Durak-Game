import SwiftUI
import AuthenticationServices

/// First-run & post-sign-out authentication landing screen.
/// Supports Sign in with Apple, Email & Password (Create Account / Sign In), and Proceed as Guest.
struct WelcomeView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var auth = ConvexAuth.shared
    @State private var presentedAuthMode: ConvexAuth.PasswordAuthFlow? = nil
    @State private var showDisplayNamePrompt = false
    @State private var isAppleBusy = false
    @State private var isGuestBusy = false
    @State private var errorMessage: String? = nil

    @State private var heroScale: CGFloat = 0.88
    @State private var heroOpacity: Double = 0
    @State private var markBob: CGFloat = 0
    @State private var markTilt: Double = -2

    private var isWide: Bool { DesignTokens.Layout.isPadOrMac }

    var body: some View {
        GeometryReader { proxy in
            let isLandscape = proxy.size.width > proxy.size.height
            let heroMultiplier: CGFloat = isWide ? (isLandscape ? 1.12 : 1.26) : 0.96

            ZStack {
                // 1. Dynamic felt gradient background
                LinearGradient(
                    colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                // Ambient radial glow behind crest
                RadialGradient(
                    colors: [
                        theme.ui.accent.opacity(0.18),
                        theme.ui.accent.opacity(0.04),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 12,
                    endRadius: 280 * heroMultiplier
                )
                .offset(y: -80 * heroMultiplier)
                .ignoresSafeArea()

                VStack(spacing: isLandscape ? DesignTokens.Spacing.md : DesignTokens.Spacing.xl) {
                    Spacer(minLength: isLandscape ? 12 : 24)

                    // 2. Hero Crest: 5-Card Fan + Floating Jester Fool + Brand Title
                    VStack(spacing: 0) {
                        ZStack {
                            Circle()
                                .stroke(theme.ui.accent.opacity(0.10), lineWidth: 1)
                                .frame(width: 260 * heroMultiplier, height: 260 * heroMultiplier)

                            Circle()
                                .stroke(theme.ui.accent.opacity(0.15), lineWidth: 1)
                                .frame(width: 204 * heroMultiplier, height: 204 * heroMultiplier)

                            VStack(spacing: 16 * heroMultiplier) {
                                Image("JesterFool")
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 118 * heroMultiplier, height: 118 * heroMultiplier)
                                    .shadow(color: Color.black.opacity(0.40), radius: 16, y: 8)
                                    .offset(y: markBob)
                                    .rotationEffect(.degrees(markTilt))

                                HomeCardFanView(
                                    cardPalette: theme.cardPalette,
                                    accent: theme.ui.accent,
                                    reduceMotion: reduceMotion,
                                    cardWidth: round(54 * heroMultiplier),
                                    cardHeight: round(76 * heroMultiplier),
                                    spreadScale: heroMultiplier
                                )
                                .frame(height: 86 * heroMultiplier)
                                .offset(y: -10 * heroMultiplier)
                            }
                        }
                        .frame(height: 216 * heroMultiplier)

                        Color.clear.frame(height: isLandscape ? 24 : 36)

                        VStack(spacing: DesignTokens.Spacing.xs) {
                            Text("DURAK")
                                .font(DesignTokens.Typography.hero)
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: theme.ui.accentGradient,
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .tracking(isWide ? 10 : 8)
                                .shadow(color: theme.ui.accent.opacity(0.42), radius: 18)

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

                            Text("Play solo against sharp AI or challenge friends online.\nSign in to sync your Gold, Credits, and stats.")
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                                .multilineTextAlignment(.center)
                                .lineSpacing(2)
                                .padding(.horizontal, DesignTokens.Spacing.lg)
                                .padding(.top, 2)
                        }
                    }
                    .scaleEffect(heroScale)
                    .opacity(heroOpacity)

                    Spacer(minLength: isLandscape ? 8 : 16)

                    // 3. Authentication Action Stack
                    VStack(spacing: 12) {
                        if let error = errorMessage {
                            Text(error)
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.danger)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, DesignTokens.Spacing.md)
                        }

                        // A. Sign in with Apple (Primary Apple HIG style)
                        Button {
                            handleAppleSignIn()
                        } label: {
                            HStack(spacing: 10) {
                                if isAppleBusy {
                                    ProgressView()
                                        .tint(.black)
                                } else {
                                    Image(systemName: "apple.logo")
                                        .font(.system(size: 19, weight: .semibold))
                                }
                                Text(isAppleBusy ? "Signing in with Apple…" : "Sign in with Apple")
                                    .font(.system(size: isWide ? 18 : 16, weight: .semibold))
                            }
                            .foregroundStyle(Color.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: isWide ? 54 : 50)
                            .background(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                    .fill(Color.white)
                            )
                            .shadow(color: Color.black.opacity(0.32), radius: 10, y: 4)
                        }
                        .buttonStyle(.springPressable(scale: 0.97, feedback: .confirm))
                        .disabled(isAppleBusy || isGuestBusy)

                        // B. Continue with Email (Theme Accent Gradient)
                        Button {
                            errorMessage = nil
                            presentedAuthMode = .signUp
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "envelope.fill")
                                    .font(.system(size: 15, weight: .bold))
                                Text("CONTINUE WITH EMAIL")
                                    .font(DesignTokens.Typography.heading)
                                    .tracking(1.6)
                            }
                            .foregroundStyle(theme.ui.accentText)
                            .frame(maxWidth: .infinity)
                            .frame(height: isWide ? 54 : 50)
                            .background(
                                LinearGradient(
                                    colors: theme.ui.accentGradient,
                                    startPoint: .leading,
                                    endPoint: .trailing
                                ),
                                in: RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                            )
                            .goldenShimmer()
                            .shadow(color: theme.ui.accent.opacity(0.40), radius: 12, y: 4)
                        }
                        .buttonStyle(.springPressable(scale: 0.97, feedback: .uiTap))
                        .disabled(isAppleBusy || isGuestBusy)

                        // C. Proceed as Guest (Glassmorphic Outline Pill)
                        Button {
                            handleContinueAsGuest()
                        } label: {
                            HStack(spacing: 8) {
                                if isGuestBusy {
                                    ProgressView()
                                        .tint(theme.ui.accent)
                                } else {
                                    Image(systemName: "suit.spade.fill")
                                        .font(.system(size: 14, weight: .bold))
                                }
                                Text(isGuestBusy ? "STARTING GUEST SESSION..." : "CONTINUE AS GUEST")
                                    .font(DesignTokens.Typography.button)
                                    .tracking(1.4)
                            }
                            .foregroundStyle(theme.ui.accent)
                            .frame(maxWidth: .infinity)
                            .frame(height: isWide ? 50 : 46)
                            .background(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                    .fill(theme.ui.surfaceGlass)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                            .stroke(theme.ui.accent.opacity(0.40), lineWidth: 1.2)
                                    )
                            )
                        }
                        .buttonStyle(.springPressable(scale: 0.97, feedback: .uiTap))
                        .disabled(isAppleBusy || isGuestBusy)

                        // Quick Sign-In link for existing email accounts
                        Button {
                            errorMessage = nil
                            presentedAuthMode = .signIn
                        } label: {
                            HStack(spacing: 4) {
                                Text("Already have an account?")
                                    .foregroundStyle(DesignTokens.Colors.textMuted)
                                Text("Sign In")
                                    .fontWeight(.bold)
                                    .foregroundStyle(theme.ui.accent)
                            }
                            .font(DesignTokens.Typography.caption)
                            .padding(.top, 4)
                        }
                        .buttonStyle(.springPressable(scale: 0.96, feedback: .selection))
                        .disabled(isAppleBusy || isGuestBusy)
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxContentWidth)
                    .padding(.horizontal, DesignTokens.Spacing.xxl)
                    .padding(.bottom, isLandscape ? DesignTokens.Spacing.lg : DesignTokens.Spacing.xl)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.65, dampingFraction: 0.76)) {
                heroScale = 1.0
                heroOpacity = 1.0
            }
            if !reduceMotion {
                withAnimation(.easeInOut(duration: 2.8).repeatForever(autoreverses: true)) {
                    markBob = -5
                    markTilt = 2
                }
            }
            // Resume one-shot name prompt if Apple sign-in finished without a usable name
            // (Apple only returns fullName on first authorization; later logins use Keychain).
            if auth.needsDisplayNamePrompt {
                showDisplayNamePrompt = true
            }
#if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-showAuthSheet") {
                presentedAuthMode = .signUp
            } else if args.contains("-showSignInSheet") {
                presentedAuthMode = .signIn
            } else if args.contains("-showDisplayNamePrompt") {
                showDisplayNamePrompt = true
            }
#endif
        }
        .onChange(of: auth.needsDisplayNamePrompt) { _, needs in
            if needs {
                showDisplayNamePrompt = true
            }
        }
        .sheet(item: $presentedAuthMode) { mode in
            AuthSheet(initialMode: mode) {
                router.navigate(to: .home)
            }
            .environment(theme)
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showDisplayNamePrompt) {
            DisplayNamePromptSheet {
                router.navigate(to: .home)
            }
            .environment(theme)
        }
    }

    // MARK: - Actions

    private func handleAppleSignIn() {
        guard !isAppleBusy && !isGuestBusy else { return }
        errorMessage = nil
        isAppleBusy = true

        AppleSignInCoordinator.shared.requestSignIn { outcome in
            Task { @MainActor in
                switch outcome {
                case .success(let credential):
                    do {
                        try await ConvexAuth.shared.signInWithApple(credential: credential)
                        isAppleBusy = false
                        FeedbackManager.shared.trigger(.confirm)
                        finishAppleSignIn()
                    } catch {
                        isAppleBusy = false
                        errorMessage = error.localizedDescription
                        FeedbackManager.shared.trigger(.failure)
                    }
                case .simulatorFallback:
                    do {
                        try await ConvexAuth.shared.signInWithAppleSimulatorFallback()
                        isAppleBusy = false
                        FeedbackManager.shared.trigger(.confirm)
                        finishAppleSignIn()
                    } catch {
                        isAppleBusy = false
                        errorMessage = error.localizedDescription
                        FeedbackManager.shared.trigger(.failure)
                    }
                case .cancelled:
                    isAppleBusy = false
                case .failure(let error):
                    isAppleBusy = false
                    errorMessage = error.localizedDescription
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }

    private func finishAppleSignIn() {
        if ConvexAuth.shared.needsDisplayNamePrompt {
            showDisplayNamePrompt = true
        } else {
            router.navigate(to: .home)
        }
    }

    private func handleContinueAsGuest() {
        guard !isGuestBusy && !isAppleBusy else { return }
        errorMessage = nil
        isGuestBusy = true

        Task {
            try? await ConvexAuth.shared.signInAsGuest()
            await MainActor.run {
                isGuestBusy = false
                FeedbackManager.shared.trigger(.confirm)
                router.navigate(to: .home)
            }
        }
    }
}
