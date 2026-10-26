import SwiftUI
import SpriteKit
import DurakGameCore

/// Game screen — hosts the SpriteKit scene with SwiftUI overlays.
/// Adaptively scales for iPhone (Portrait), iPadOS (Portrait & Landscape), and macOS Apple Silicon.
struct GameView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme
    @Environment(GameViewModel.self) private var gameVM
    @Environment(\.scenePhase) private var scenePhase

    @State private var scene: GameScene = {
        let sc = GameScene()
        sc.scaleMode = .resizeFill
        return sc
    }()

    @State private var showForfeitAlert = false
    @State private var showGraveyard = false
    @State private var showReveal = false
    @State private var showSkills = false
    @State private var showEmojiPicker = false
    @State private var activeSeatReaction: ActiveSeatReaction? = nil
    @State private var lastShownReactionAt: TimeInterval = 0
    @State private var dockBottomPadding: CGFloat = 156
    /// Opponent avatar anchors in SpriteView / full-bleed UIKit coords.
    @State private var opponentReactionAnchors: [String: CGPoint] = [:]

    private var isWide: Bool { DesignTokens.Layout.isPadOrMac }
    private var reactionBurstSize: CGFloat { isWide ? 72 : 56 }

    /// Pause the SpriteKit loop when backgrounded or covered by sheets/settings.
    private var shouldPauseScene: Bool {
        scenePhase != .active
            || showEmojiPicker
            || showSkills
            || showGraveyard
            || showReveal
            || showForfeitAlert
            || router.settingsPresented
    }

    var body: some View {
        ZStack {
            // Background table gradient matching active theme
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // 1. SpriteKit Card Table Scene
            SpriteView(
                scene: scene,
                isPaused: shouldPauseScene,
                preferredFramesPerSecond: 60,
                options: [.ignoresSiblingOrder]
            )
                .ignoresSafeArea()
                .onAppear {
                    scene.appearance = theme.activeAppearance
                    scene.resetOpeningDealState()
                    scene.onSeatAnchorsChanged = { anchors in
                        opponentReactionAnchors = anchors
                    }
                    if let g = gameVM.game {
                        scene.syncState(game: g, vm: gameVM)
                    }
                    refreshOpponentAnchors()
                }
                .onChange(of: gameVM.game) { _, newGame in
                    if let g = newGame {
                        scene.syncState(game: g, vm: gameVM)
                        refreshOpponentAnchors()
                        if g.phase == .gameOver && router.current == .game {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                                if router.current == .game {
                                    router.navigate(to: .result)
                                }
                            }
                        }
                    }
                }
                .onChange(of: gameVM.turnDeadlineAt) { _, _ in
                    if let g = gameVM.game {
                        scene.syncState(game: g, vm: gameVM)
                    }
                }
                .onChange(of: gameVM.onlineRoomId) { _, newId in
                    // Evicted / left mid-match — don't leave a blank game screen.
                    if newId == nil, gameVM.game == nil, router.current == .game {
                        router.navigate(to: .home)
                    }
                }
                .onChange(of: theme.activeAppearanceId) { _, _ in
                    scene.appearance = theme.activeAppearance
                    if let g = gameVM.game {
                        scene.syncState(game: g, vm: gameVM)
                    }
                    refreshOpponentAnchors()
                }

            // Seat-anchored reaction burst (above avatar / self emoji dock)
            if let active = activeSeatReaction {
                seatReactionOverlay(active)
                    .allowsHitTesting(false)
                    .zIndex(40)
            }

            // 2. SwiftUI Bottom UI Overlays (Dock & Action Bar)
            if let _ = gameVM.game {
                VStack(spacing: 0) {
                    Spacer()

                    // Strategic Hint Toast
                    if let hint = gameVM.hintMessage {
                        HStack(spacing: 6) {
                            Text(hint)
                                .font(DesignTokens.Typography.caption)
                                .fontWeight(.bold)
                                .foregroundStyle(theme.ui.accent)

                            Image(systemName: "xmark.circle.fill")
                                .font(.caption2)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(theme.ui.surfaceCard)
                                .overlay(Capsule().stroke(theme.ui.accent.opacity(0.6), lineWidth: 1.5))
                                .shadow(color: theme.ui.accent.opacity(0.35), radius: 8)
                        )
                        .onTapGesture {
                            withAnimation(.spring) {
                                gameVM.clearHint()
                            }
                        }
                        .transition(.scale.combined(with: .opacity))
                        .padding(.bottom, 10)
                    }

                    if let notice = gameVM.onlineNotice
                        ?? OnlineBridge.shared.syncErrorMessage
                        ?? gameVM.slowConnectionNotice {
                        HStack(spacing: 8) {
                            Image(systemName: gameVM.onlineNotice != nil || OnlineBridge.shared.syncErrorMessage != nil
                                  ? "exclamationmark.circle.fill"
                                  : "wifi.exclamationmark")
                                .foregroundStyle(theme.ui.accent)
                            Text(notice)
                                .font(DesignTokens.Typography.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(DesignTokens.Colors.textLight)
                                .lineLimit(2)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(theme.ui.surfaceCard)
                                .overlay(Capsule().stroke(theme.ui.accent.opacity(0.45), lineWidth: 1))
                        )
                        .padding(.bottom, 10)
                    }

                    // Bottom Controls Layer: Centered and aligned dock
                    ZStack(alignment: .center) {
                        // Hide Emoji/Skills when truly out (finishedOrder) — spectator mode
                        if !gameVM.isHumanFinished {
                            HStack {
                                EmojiButton {
                                    showEmojiPicker = true
                                }

                                Spacer()

                                SkillsButton {
                                    showSkills = true
                                }
                            }
                            .frame(maxWidth: isWide ? 820 : .infinity)
                            .padding(.horizontal, isWide ? DesignTokens.Spacing.xl : DesignTokens.Spacing.lg)
                        }

                        // Action Bar (Take / Done / Undo) — already no-ops when finished
                        ActionBar(gameVM: gameVM)
                    }
                    .frame(height: isWide ? 52 : 44)
                    .padding(.bottom, dockBottomPadding)
                }

                // 3. Top chrome: corners hug Island; banner slightly lower; safe-area respected
                VStack(spacing: 0) {
                    cornerTopBar
                    Spacer()
                }
            }
        }
        .background {
            GeometryReader { proxy in
                Color.clear
                    .onAppear { applyLayoutMetrics(size: proxy.size, insets: proxy.safeAreaInsets) }
                    .onChange(of: proxy.size.width) { _, _ in
                        applyLayoutMetrics(size: proxy.size, insets: proxy.safeAreaInsets)
                    }
                    .onChange(of: proxy.size.height) { _, _ in
                        applyLayoutMetrics(size: proxy.size, insets: proxy.safeAreaInsets)
                    }
                    .onChange(of: proxy.safeAreaInsets.top) { _, _ in
                        applyLayoutMetrics(size: proxy.size, insets: proxy.safeAreaInsets)
                    }
                    .onChange(of: proxy.safeAreaInsets.bottom) { _, _ in
                        applyLayoutMetrics(size: proxy.size, insets: proxy.safeAreaInsets)
                    }
            }
        }
        .statusBarHidden()
        .confirmationDialog("Leave Game?", isPresented: $showForfeitAlert, titleVisibility: .visible) {
            Button("Forfeit & Leave", role: .destructive) {
                Task {
                    await gameVM.forfeitAndLeave()
                    router.navigate(to: .home)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Leaving now returns you to the main menu.")
        }
        .sheet(isPresented: $showEmojiPicker) {
            EmojiPickerSheet { emoji in
                presentReaction(emoji, from: gameVM.humanId)
                if gameVM.playMode == .online, let roomId = gameVM.onlineRoomId {
                    Task {
                        await OnlineBridge.shared.sendReaction(roomId: roomId, emoji: emoji)
                    }
                }
            }
            .presentationDetents([.fraction(0.48), .medium])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showSkills) {
            SkillsSheet(
                gameVM: gameVM,
                onReveal: {
                    showSkills = false
                    showReveal = true
                },
                onGraveyard: {
                    showSkills = false
                    showGraveyard = true
                },
                onHint: {
                    showSkills = false
                    withAnimation(.spring) {
                        gameVM.requestStrategicHint()
                    }
                },
                onUndo: {
                    showSkills = false
                    gameVM.returnLastCard()
                }
            )
            .presentationDetents([.fraction(0.58), .medium])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showGraveyard) {
            if let g = gameVM.game {
                GraveyardSheet(discardPile: g.discard, trumpSuit: g.trumpSuit)
            }
        }
        .sheet(isPresented: $showReveal) {
            if let g = gameVM.game {
                let firstOpp = g.players.first(where: { $0 != gameVM.humanId }) ?? ""
                let oppCards = handOf(g, firstOpp)
                RevealSheet(
                    opponentName: gameVM.names[firstOpp] ?? "Opponent",
                    cards: oppCards,
                    trumpSuit: g.trumpSuit
                )
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if gameVM.playMode == .online {
                OnlineBridge.shared.setAppActive(phase == .active)
            }
        }
        .onChange(of: gameVM.remoteReaction?.at) { _, _ in
            guard let reaction = gameVM.remoteReaction else { return }
            // Skip echo of our own send (already shown locally).
            guard reaction.fromPlayerId != gameVM.humanId else {
                lastShownReactionAt = reaction.at
                return
            }
            guard reaction.at > lastShownReactionAt else { return }
            lastShownReactionAt = reaction.at
            presentReaction(reaction.emoji, from: reaction.fromPlayerId)
        }
        .onAppear {
            NotoLottieCache.warmAll()
            scene.onSeatAnchorsChanged = { anchors in
                opponentReactionAnchors = anchors
            }
            refreshOpponentAnchors()
            if gameVM.playMode == .online {
                OnlineBridge.shared.setAppActive(scenePhase == .active)
            }
        }
    }

    @ViewBuilder
    private func seatReactionOverlay(_ active: ActiveSeatReaction) -> some View {
        let size = reactionBurstSize
        GeometryReader { geo in
            let point = burstScreenPoint(for: active.fromPlayerId, in: geo.size)
            SeatReactionBurstView(token: active.token, size: size)
                .position(point)
                .id(active.id)
        }
        .ignoresSafeArea()
    }

    private func burstScreenPoint(for playerId: String, in size: CGSize) -> CGPoint {
        if playerId == gameVM.humanId {
            // Centered above the bottom action dock (not left emoji button).
            let lift: CGFloat = isWide ? 28 : 20
            return CGPoint(
                x: size.width / 2,
                y: size.height - dockBottomPadding - lift
            )
        }
        if let anchor = opponentReactionAnchors[playerId] {
            return anchor
        }
        // Unknown seat — soft center-top fallback (should be rare).
        return CGPoint(x: size.width / 2, y: 120)
    }

    private func presentReaction(_ token: String, from playerId: String) {
        let payload = ActiveSeatReaction(
            token: token,
            fromPlayerId: playerId,
            id: Date().timeIntervalSince1970
        )
        withAnimation(.spring(response: 0.32, dampingFraction: 0.72)) {
            activeSeatReaction = payload
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            withAnimation(.easeOut(duration: 0.28)) {
                if activeSeatReaction?.id == payload.id {
                    activeSeatReaction = nil
                }
            }
        }
    }

    private func refreshOpponentAnchors() {
        // Defer one frame so SpriteKit has applied seat positions after sync/layout.
        DispatchQueue.main.async {
            opponentReactionAnchors = scene.allOpponentReactionAnchors()
        }
    }

    // MARK: - Safe-area top chrome (corners high · banner slightly lower)

    /// SwiftUI chrome depth below the safe-area top (corner pad + controls / banner).
    private var chromeBelowSafeArea: CGFloat {
        isWide ? 58 : 46
    }

    private var cornerTopBar: some View {
        let btnSize = DesignTokens.Layout.chromeButtonSize
        let iconScale: CGFloat = isWide ? 1.15 : 1.0
        return ZStack(alignment: .top) {
            // Corner controls — tight under Dynamic Island / notch flanks, styled identically to Emoji/Skills buttons
            HStack {
                chromeCircleButton(systemName: "xmark", size: round(17 * iconScale), buttonSize: btnSize) {
                    showForfeitAlert = true
                }
                Spacer(minLength: 0)
                chromeCircleButton(systemName: "gearshape.fill", size: round(18 * iconScale), buttonSize: btnSize) {
                    router.settingsPresented = true
                }
            }
            .padding(.horizontal, isWide ? 28 : DesignTokens.Spacing.lg)
            .padding(.top, isWide ? 8 : 2)

            // Status capsule — centered, a step below the corner buttons
            if let game = gameVM.game {
                TurnStatusBanner(
                    game: game,
                    humanId: gameVM.humanId,
                    names: gameVM.names,
                    isSubmittingOnlineMove: gameVM.playMode == .online && gameVM.isSubmittingOnlineMove,
                    opponentReconnecting: gameVM.playMode == .online && gameVM.opponentReconnecting
                )
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.horizontal, isWide ? 96 : 68)
                    .padding(.top, isWide ? 14 : 10)
            }
        }
        .frame(maxWidth: .infinity)
        // Reserve layout height so Spacer below doesn't collapse under the ZStack
        .frame(height: chromeBelowSafeArea)
    }

    private func chromeCircleButton(
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

    /// Push SpriteKit seats below SwiftUI chrome and keep the bottom dock cleanly above the hand fan.
    private func applyLayoutMetrics(size: CGSize, insets: EdgeInsets) {
        let top = insets.top + chromeBelowSafeArea
        let bottom = insets.bottom
        let current = scene.contentInsets
        if abs(current.top - top) > 0.5 || abs(current.bottom - bottom) > 0.5 {
            scene.contentInsets = UIEdgeInsets(top: top, left: 0, bottom: bottom, right: 0)
        }

        let fullWidth = size.width + insets.leading + insets.trailing
        let fullHeight = size.height + insets.top + insets.bottom
        let fullSize = CGSize(width: fullWidth, height: fullHeight)
        let usableHeight = max(120, fullHeight - top - bottom)
        let isLandscape = fullWidth > fullHeight
        let isWideDevice = min(fullWidth, fullHeight) >= 700
        let isCompactScreen = fullHeight < 720 && !isWideDevice
        let spriteScale = DesignTokens.Layout.spriteScale(for: fullSize)

        let handCenterFromSafeBottom: CGFloat
        if isWideDevice {
            handCenterFromSafeBottom = isLandscape
                ? max(92, usableHeight * 0.145)
                : max(106, usableHeight * 0.125)
        } else {
            handCenterFromSafeBottom = isCompactScreen
                ? max(78, usableHeight * 0.125)
                : max(82, usableHeight * 0.12)
        }

        // Scaled hand card half-height + breathing room above the hand fan
        let scaledHalfCardHeight: CGFloat = 60 * spriteScale
        let airGap: CGFloat = isWideDevice ? 28 : 24
        let targetDockPadding = round(handCenterFromSafeBottom + scaledHalfCardHeight + airGap)
        if abs(dockBottomPadding - targetDockPadding) > 0.5 {
            dockBottomPadding = targetDockPadding
        }
        refreshOpponentAnchors()
    }
}
