import SwiftUI
import SpriteKit
import DurakGameCore

/// Game screen — hosts the SpriteKit scene with SwiftUI overlays.
struct GameView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme
    @Environment(GameViewModel.self) private var gameVM

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
    @State private var floatingReaction: String? = nil

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
            SpriteView(scene: scene, isPaused: false, options: [.allowsTransparency])
                .ignoresSafeArea()
                .onAppear {
                    scene.appearance = theme.activeAppearance
                    if let g = gameVM.game {
                        scene.syncState(game: g, vm: gameVM)
                    }
                }
                .onChange(of: gameVM.game) { _, newGame in
                    if let g = newGame {
                        scene.syncState(game: g, vm: gameVM)
                        if g.phase == .gameOver && router.current == .game {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                                if router.current == .game {
                                    router.navigate(to: .result)
                                }
                            }
                        }
                    }
                }
                .onChange(of: theme.activeAppearanceId) { _, _ in
                    scene.appearance = theme.activeAppearance
                    if let g = gameVM.game {
                        scene.syncState(game: g, vm: gameVM)
                    }
                }

            // 2. SwiftUI Bottom UI Overlays (Dock & Action Bar)
            if let _ = gameVM.game {
                VStack(spacing: 0) {
                    Spacer()

                    // Floating Reaction if triggered
                    if let reaction = floatingReaction {
                        Text(reaction)
                            .font(.system(size: 64))
                            .transition(.scale.combined(with: .opacity))
                            .padding(.bottom, 20)
                    }

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
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                        }

                        // Action Bar (Take / Done / Undo) — already no-ops when finished
                        ActionBar(gameVM: gameVM)
                    }
                    .frame(height: 44)
                    .padding(.bottom, 134)
                }

                // 3. Top Section: Dynamic Island Corner Controls + Status Banner (elevated)
                VStack(spacing: 0) {
                    cornerTopBar

                    TurnStatusBanner(game: gameVM.game!, humanId: gameVM.humanId)
                        .padding(.top, 2)

                    Spacer()
                }
                .ignoresSafeArea(edges: .top)
            }
        }
        .statusBarHidden()
        .confirmationDialog("Leave Game?", isPresented: $showForfeitAlert, titleVisibility: .visible) {
            Button("Forfeit & Leave", role: .destructive) {
                gameVM.forfeitAndLeave()
                router.navigate(to: .home)
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Leaving now returns you to the main menu.")
        }
        .sheet(isPresented: $showEmojiPicker) {
            EmojiPickerSheet { emoji in
                withAnimation(.spring) {
                    floatingReaction = emoji
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                    withAnimation {
                        floatingReaction = nil
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
    }

    // MARK: - Dynamic Island Corner Top Bar

    private var cornerTopBar: some View {
        GeometryReader { proxy in
            let topInset = proxy.safeAreaInsets.top
            let cornerTop = topInset >= 50 ? 10.0 : max(8.0, topInset * 0.22)

            HStack {
                // Exit / Forfeit (X) in top-left corner
                Button {
                    FeedbackManager.shared.trigger(.selection)
                    showForfeitAlert = true
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(DesignTokens.Colors.textLight)
                        .frame(width: 38, height: 38)
                        .background(
                            Circle()
                                .fill(.ultraThinMaterial)
                                .overlay(Circle().stroke(Color.white.opacity(0.18), lineWidth: 1))
                                .shadow(color: Color.black.opacity(0.25), radius: 4, y: 2)
                        )
                }

                Spacer()

                // Settings in top-right corner
                Button {
                    FeedbackManager.shared.trigger(.selection)
                    router.settingsPresented = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(DesignTokens.Colors.textLight)
                        .frame(width: 38, height: 38)
                        .background(
                            Circle()
                                .fill(.ultraThinMaterial)
                                .overlay(Circle().stroke(Color.white.opacity(0.18), lineWidth: 1))
                                .shadow(color: Color.black.opacity(0.25), radius: 4, y: 2)
                        )
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, cornerTop)
        }
        .frame(height: 52)
    }
}
