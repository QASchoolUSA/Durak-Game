import SwiftUI
import DurakGameCore

/// Home screen — main menu with PLAY and JOIN buttons, Jester emblem, and React Native-style 5-card fan underneath.
/// Adaptively scales for iPhone (Portrait), iPadOS (Portrait & Landscape), and macOS Apple Silicon.
struct HomeView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme
    @Environment(GameViewModel.self) private var gameVM
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var showGameConfig = false
    @State private var heroScale: CGFloat = 0.88
    @State private var heroOpacity: Double = 0
    @State private var markBob: CGFloat = 0
    @State private var markTilt: Double = -2
    @State private var resumableRoom: OnlineBridge.ActiveRoomSummary? = nil
    @State private var isResuming = false

    private var isWide: Bool { DesignTokens.Layout.isPadOrMac }

    var body: some View {
        GeometryReader { proxy in
            let isLandscape = proxy.size.width > proxy.size.height
            let heroMultiplier: CGFloat = isWide ? (isLandscape ? 1.18 : 1.32) : 1.0

            ZStack {
                // Background
                LinearGradient(
                    colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                HomeHeroBackdrop(accent: theme.ui.accent, reduceMotion: reduceMotion, scale: heroMultiplier)

                VStack(spacing: isLandscape ? DesignTokens.Spacing.lg : DesignTokens.Spacing.xl) {
                    Spacer(minLength: isLandscape ? 20 : 28)

                    // Hero: Jester mark + 5-Card Fan underneath + Title
                    VStack(spacing: 0) {
                        ZStack {
                            Circle()
                                .fill(theme.ui.accent.opacity(0.14))
                                .frame(width: 240 * heroMultiplier, height: 240 * heroMultiplier)
                                .blur(radius: 26)

                            VStack(spacing: 18 * heroMultiplier) {
                                // Jester Fool Emblem positioned well above the fanned cards
                                Image("JesterFool")
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 124 * heroMultiplier, height: 124 * heroMultiplier)
                                    .shadow(color: Color.black.opacity(0.38), radius: 16, y: 8)
                                    .offset(y: markBob)
                                    .rotationEffect(.degrees(markTilt))

                                // Fanned playing cards — lifted; bottom padding reserves room for rotated outer tips
                                HomeCardFanView(
                                    cardPalette: theme.cardPalette,
                                    accent: theme.ui.accent,
                                    reduceMotion: reduceMotion,
                                    cardWidth: round(58 * heroMultiplier),
                                    cardHeight: round(82 * heroMultiplier),
                                    spreadScale: heroMultiplier
                                )
                                .frame(height: 92 * heroMultiplier)
                                .offset(y: -10 * heroMultiplier)
                            }
                        }
                        .frame(height: 236 * heroMultiplier)

                        // Explicit air between card tips and brand title (rotation overhang is ~20–28pt)
                        Color.clear.frame(height: isLandscape ? 28 : 36)

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
                                .shadow(color: theme.ui.accent.opacity(0.4), radius: 20)

                            // Ornamental divider with diamond (from HomeHero.tsx)
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

                            Text("CARD GAME")
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                                .tracking(4)
                        }
                    }
                    .scaleEffect(heroScale)
                    .opacity(heroOpacity)

                    Spacer()

                    // Action buttons (constrained on iPad / Mac so they look sleek and proportional)
                    VStack(spacing: DesignTokens.Spacing.md) {
                        Button {
                            showGameConfig = true
                        } label: {
                            Text("PLAY")
                                .font(DesignTokens.Typography.title)
                                .tracking(3)
                                .foregroundStyle(theme.ui.accentText)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, isWide ? 18 : DesignTokens.Spacing.md)
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
                            router.joinSheetPresented = true
                        } label: {
                            Text("JOIN GAME")
                                .font(DesignTokens.Typography.heading)
                                .tracking(1)
                                .foregroundStyle(theme.ui.accent)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, isWide ? 14 : DesignTokens.Spacing.sm)
                                .background(
                                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                        .stroke(theme.ui.accent.opacity(0.35), lineWidth: 1.2)
                                )
                        }
                        .buttonStyle(.springPressable(feedback: .uiTap))
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxContentWidth)
                    .padding(.horizontal, DesignTokens.Spacing.xxl)
                    .padding(.bottom, isLandscape ? DesignTokens.Spacing.lg : DesignTokens.Spacing.xl)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Top chrome: Rules (left) · Settings (right) — styled identically to in-game buttons
                VStack(spacing: 0) {
                    homeCornerTopBar
                    if let room = resumableRoom {
                        resumeBanner(room)
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                            .padding(.top, DesignTokens.Spacing.sm)
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                    Spacer()
                }
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
            refreshResumableRooms()
#if DEBUG
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-showConfig") {
                showGameConfig = true
            } else if args.contains("-showJoin") {
                router.joinSheetPresented = true
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
        .sheet(isPresented: Binding(
            get: { router.joinSheetPresented },
            set: { router.joinSheetPresented = $0 }
        )) {
            JoinGameSheet()
                .environment(gameVM)
                .environment(theme)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Mid-game resume

    private func resumeBanner(_ room: OnlineBridge.ActiveRoomSummary) -> some View {
        Button {
            resumeActiveRoom(room)
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(room.isYourTurn ? "Your turn — rejoin" : "Game in progress")
                        .font(DesignTokens.Typography.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(theme.ui.accent)
                    Text(resumeSubtitle(room))
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.textLight)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Text(isResuming ? "…" : "Resume")
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.heavy)
                    .foregroundStyle(theme.ui.accentText)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(theme.ui.accent))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                    .fill(theme.ui.surfaceCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                            .stroke(theme.ui.accent.opacity(0.55), lineWidth: 1.5)
                    )
            )
        }
        .buttonStyle(.springPressable(feedback: .confirm))
        .disabled(isResuming)
    }

    private func resumeSubtitle(_ room: OnlineBridge.ActiveRoomSummary) -> String {
        let names = room.opponents.filter { !$0.isEmpty }
        if names.isEmpty { return "Tap to rejoin table \(room.code)" }
        return "With \(names.joined(separator: ", "))"
    }

    private func refreshResumableRooms() {
        Task {
            // Clear first so a stale banner cannot stick after forfeit while the query runs.
            await MainActor.run {
                if resumableRoom != nil {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) {
                        resumableRoom = nil
                    }
                }
            }
            // Prefer server truth; fall back to SessionStore roomId.
            do {
                let rooms = try await OnlineBridge.shared.fetchMyActiveRooms()
                let playing = rooms.filter { $0.status == "playing" }
                let pool = playing.isEmpty ? rooms : playing
                let best = pool.first(where: { $0.isYourTurn }) ?? pool.first
                await MainActor.run {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) {
                        resumableRoom = best
                    }
                }
            } catch {
                if let session = SessionStore.shared.currentSession, !session.roomId.isEmpty {
                    await MainActor.run {
                        resumableRoom = OnlineBridge.ActiveRoomSummary(
                            roomId: session.roomId,
                            code: session.roomCode,
                            status: "playing",
                            seatIndex: 0,
                            yourPlayerId: session.playerId,
                            opponents: [],
                            humanCount: 2,
                            lastMoveAt: 0,
                            isYourTurn: false
                        )
                    }
                } else {
                    await MainActor.run { resumableRoom = nil }
                }
            }
        }
    }

    private func resumeActiveRoom(_ room: OnlineBridge.ActiveRoomSummary) {
        guard !isResuming else { return }
        isResuming = true
        OnlineBridge.shared.resumeRoom(roomId: room.roomId, roomCode: room.code)
        gameVM.onlineRoomId = room.roomId
        gameVM.onlineRoomCode = room.code
        gameVM.onlineIsHost = false
        gameVM.playMode = .online
        isResuming = false
        if room.status == "lobby" {
            router.navigate(to: .lobby)
        } else {
            router.navigate(to: .game)
        }
    }

    // MARK: - Corner Top Bar (Rules left · Settings right)

    private var homeCornerTopBar: some View {
        let btnSize = DesignTokens.Layout.chromeButtonSize
        let iconScale: CGFloat = isWide ? 1.15 : 1.0
        return HStack {
            homeChromeCircleButton(systemName: "book.fill", size: round(17 * iconScale), buttonSize: btnSize) {
                router.rulesPresented = true
            }
            Spacer(minLength: 0)
            homeChromeCircleButton(systemName: "gearshape.fill", size: round(18 * iconScale), buttonSize: btnSize) {
                router.settingsPresented = true
            }
        }
        .padding(.horizontal, isWide ? 28 : 20)
        .padding(.top, isWide ? 8 : 2)
        .frame(maxWidth: .infinity)
        .frame(height: btnSize + 6)
    }

    private func homeChromeCircleButton(
        systemName: String,
        size: CGFloat,
        buttonSize: CGFloat,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
        } label: {
            Circle()
                .fill(theme.ui.surfaceGlass)
                .frame(width: buttonSize, height: buttonSize)
                .overlay(
                    Circle()
                        .stroke(theme.ui.accent.opacity(0.40), lineWidth: 1.2)
                )
                .overlay(
                    Image(systemName: systemName)
                        .font(.system(size: size, weight: .bold))
                        .foregroundStyle(theme.ui.accent)
                )
                .shadow(color: Color.black.opacity(0.35), radius: 6, y: 3)
        }
        .buttonStyle(.springPressable(scale: 0.90, feedback: .uiTap))
    }
}

// MARK: - 5-Card Fan Under Fool Emblem (Port of React Native `CardFan.tsx`)

struct HomeCardFanView: View {
    let cardPalette: CardPalette
    let accent: Color
    let reduceMotion: Bool
    var cardWidth: CGFloat = 62
    var cardHeight: CGFloat = 88
    var spreadScale: CGFloat = 1.0

    private struct FanCardSpec: Identifiable {
        let id: Int
        let rank: String
        let suit: String
        let isRed: Bool
        let rotation: Double
        let tx: CGFloat
        let ty: CGFloat
        let isTrump: Bool
    }

    /// 5-card fan (A♠ Q♥ J♦ K♣ 6♠). Milder arc so outer tips stay clear of the title.
    private static let specs: [FanCardSpec] = [
        FanCardSpec(id: 0, rank: "A", suit: "♠", isRed: false, rotation: -18, tx: -68, ty: 4, isTrump: false),
        FanCardSpec(id: 1, rank: "Q", suit: "♥", isRed: true,  rotation: -9,  tx: -34, ty: 1, isTrump: false),
        FanCardSpec(id: 2, rank: "J", suit: "♦", isRed: true,  rotation:  0,  tx:   0, ty: 0, isTrump: true),
        FanCardSpec(id: 3, rank: "K", suit: "♣", isRed: false, rotation:  9,  tx:  34, ty: 1, isTrump: false),
        FanCardSpec(id: 4, rank: "6", suit: "♠", isRed: false, rotation: 18,  tx:  68, ty: 4, isTrump: false),
    ]

    @State private var spread: CGFloat = 0.25
    @State private var floatY: CGFloat = 0

    var body: some View {
        ZStack {
            ForEach(Self.specs) { item in
                miniPlayingCard(item)
                    .offset(x: item.tx * spreadScale * spread, y: item.ty * spreadScale * spread)
                    .rotationEffect(.degrees(item.rotation * Double(spread)))
            }
        }
        .offset(y: floatY)
        .allowsHitTesting(false)
        .onAppear {
            withAnimation(.spring(response: 0.65, dampingFraction: 0.74)) {
                spread = 1.0
            }
            // Keep float subtle and centered so cards never drift into the Fool or the title
            floatY = 0
        }
    }

    private func miniPlayingCard(_ item: FanCardSpec) -> some View {
        let suitColor = item.isRed ? cardPalette.suitRed : cardPalette.suitBlack
        return ZStack {
            RoundedRectangle(cornerRadius: 8 * spreadScale, style: .continuous)
                .fill(cardPalette.face)
                .overlay(
                    RoundedRectangle(cornerRadius: 8 * spreadScale, style: .continuous)
                        .stroke(item.isTrump ? accent : cardPalette.faceEdge, lineWidth: item.isTrump ? 2.0 : 1.0)
                )
                .shadow(color: Color.black.opacity(0.32), radius: 6, y: 3)

            // Top-left index
            VStack(alignment: .leading, spacing: -2) {
                Text(item.rank)
                    .font(.system(size: cardWidth * 0.20, weight: .heavy))
                Text(item.suit)
                    .font(.system(size: cardWidth * 0.17, weight: .bold))
            }
            .foregroundStyle(suitColor)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.leading, 5 * spreadScale)
            .padding(.top, 4 * spreadScale)

            // Center pip
            Text(item.suit)
                .font(.system(size: cardWidth * 0.40, weight: .bold))
                .foregroundStyle(suitColor.opacity(0.9))

            // Bottom-right index (upright mirror)
            VStack(alignment: .leading, spacing: -2) {
                Text(item.rank)
                    .font(.system(size: cardWidth * 0.20, weight: .heavy))
                Text(item.suit)
                    .font(.system(size: cardWidth * 0.17, weight: .bold))
            }
            .foregroundStyle(suitColor)
            .rotationEffect(.degrees(180))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .padding(.trailing, 5 * spreadScale)
            .padding(.bottom, 4 * spreadScale)
        }
        .frame(width: cardWidth, height: cardHeight)
    }
}

// MARK: - Hero backdrop (double rings + floating diamonds)

private struct HomeHeroBackdrop: View {
    let accent: Color
    let reduceMotion: Bool
    var scale: CGFloat = 1.0

    @State private var driftA: CGFloat = 0
    @State private var driftB: CGFloat = 0

    var body: some View {
        ZStack {
            // Double ambient rings from React Native HeroPanel
            Circle()
                .stroke(accent.opacity(0.08), lineWidth: 1)
                .frame(width: 310 * scale, height: 310 * scale)
                .offset(y: -70 * scale)

            Circle()
                .stroke(accent.opacity(0.11), lineWidth: 1)
                .frame(width: 250 * scale, height: 250 * scale)
                .offset(y: -70 * scale)

            // Scattered diamonds
            diamond(size: 28 * scale, opacity: 0.12)
                .offset(x: -124 * scale, y: -35 * scale + driftA)
            diamond(size: 20 * scale, opacity: 0.10)
                .offset(x: 130 * scale, y: -65 * scale + driftB)
            diamond(size: 34 * scale, opacity: 0.08)
                .offset(x: -96 * scale, y: -155 * scale)
            diamond(size: 18 * scale, opacity: 0.14)
                .offset(x: 104 * scale, y: -135 * scale + driftA)
            diamond(size: 24 * scale, opacity: 0.09)
                .offset(x: 0, y: -185 * scale + driftB)
        }
        .allowsHitTesting(false)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 4.0).repeatForever(autoreverses: true)) {
                driftA = -4
            }
            withAnimation(.easeInOut(duration: 4.4).repeatForever(autoreverses: true).delay(0.35)) {
                driftB = 4
            }
        }
    }

    private func diamond(size: CGFloat, opacity: Double) -> some View {
        RoundedRectangle(cornerRadius: 2, style: .continuous)
            .stroke(accent.opacity(opacity), lineWidth: 1)
            .frame(width: size * 0.72, height: size * 0.72)
            .rotationEffect(.degrees(45))
    }
}
