import SwiftUI
import DurakGameCore

/// Result screen — shows winner/loser with Apple-grade celebratory effects and Play Again option.
struct ResultView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme
    @Environment(GameViewModel.self) private var gameVM

    @State private var showContent = false
    @State private var pulseAura = false
    @State private var rotateSunburst = 0.0
    @State private var settledCreditDelta: Int = 0

    var body: some View {
        ZStack {
            // 1. Dynamic Atmosphere Backdrop
            backdropView
                .ignoresSafeArea()

            // 2. Main Content
            if let game = gameVM.game, game.phase == .gameOver {
                let isDraw = game.loserId == nil
                let humanWon = game.finishedOrder.first == gameVM.humanId
                let humanLost = game.loserId == gameVM.humanId

                ScrollView(showsIndicators: false) {
                    VStack(spacing: DesignTokens.Spacing.lg) {
                        Spacer(minLength: 40)

                        // Hero Crest & Title
                        heroCrest(isDraw: isDraw, humanWon: humanWon, humanLost: humanLost)

                        // Credit settlement card (win pot or draw refund)
                        if settledCreditDelta > 0 {
                            rewardCard(delta: settledCreditDelta, isDraw: isDraw)
                                .transition(.scale.combined(with: .opacity))
                        } else if humanLost {
                            lossCard
                                .transition(.scale.combined(with: .opacity))
                        }

                        // Standings Leaderboard
                        standingsCard(game: game, humanLost: humanLost)

                        Spacer(minLength: 20)

                        // Action Buttons
                        actionButtons
                            .padding(.bottom, DesignTokens.Spacing.xl)
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxPanelWidth)
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                    .frame(maxWidth: .infinity)
                }
                .opacity(showContent ? 1 : 0)
                .offset(y: showContent ? 0 : 25)
            }
        }
        .onAppear {
            if let game = gameVM.game, game.finishedOrder.first == gameVM.humanId {
                FeedbackManager.shared.trigger(.success)
            } else {
                FeedbackManager.shared.trigger(.failure)
            }

            // Solo: settle once (idempotent; may already have run in finishGameOver).
            // Online: display pot/refund and refresh Convex wallet.
            if gameVM.playMode == .solo {
                let display = gameVM.soloResultCreditDeltaDisplay()
                if settledCreditDelta == 0 && display > 0 {
                    settledCreditDelta = display
                }
                Task {
                    let delta = await gameVM.settleSoloEconomyIfNeeded()
                    await MainActor.run {
                        if delta > 0 {
                            settledCreditDelta = delta
                        } else if settledCreditDelta == 0 {
                            settledCreditDelta = gameVM.soloResultCreditDeltaDisplay()
                        }
                    }
                }
            } else if gameVM.playMode == .online {
                let isDraw = gameVM.game?.loserId == nil
                let humanWon = gameVM.game?.finishedOrder.first == gameVM.humanId
                if isDraw {
                    settledCreditDelta = gameVM.buyIn
                } else if humanWon {
                    settledCreditDelta = gameVM.pot
                } else if settledCreditDelta == 0 {
                    settledCreditDelta = 0
                }
                Task {
                    await ConvexAuth.shared.refreshWallet()
                }
            }

            withAnimation(.spring(response: 0.7, dampingFraction: 0.75).delay(0.1)) {
                showContent = true
            }
            withAnimation(.easeInOut(duration: 2.2).repeatForever(autoreverses: true)) {
                pulseAura = true
            }
            withAnimation(.linear(duration: 24).repeatForever(autoreverses: false)) {
                rotateSunburst = 360
            }
        }
        .overlay {
            if let game = gameVM.game, game.finishedOrder.first == gameVM.humanId {
                ConfettiView()
            }
        }
    }

    // MARK: - Dynamic Atmosphere Backdrop

    @ViewBuilder
    private var backdropView: some View {
        if let game = gameVM.game {
            let humanWon = game.finishedOrder.first == gameVM.humanId
            let humanLost = game.loserId == gameVM.humanId

            if humanWon {
                RadialGradient(
                    colors: [
                        theme.tablePalette.backgroundColor,
                        theme.tablePalette.gradient?.last ?? theme.tablePalette.backgroundColor.opacity(0.4),
                        Color.black
                    ],
                    center: .top,
                    startRadius: 20,
                    endRadius: 500
                )
            } else if humanLost {
                RadialGradient(
                    colors: [
                        Color(red: 0.35, green: 0.08, blue: 0.10),
                        Color(red: 0.14, green: 0.04, blue: 0.05),
                        Color.black
                    ],
                    center: .top,
                    startRadius: 20,
                    endRadius: 500
                )
            } else {
                LinearGradient(
                    colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor, Color.black],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        } else {
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor, Color.black],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    // MARK: - Hero Crest

    private func heroCrest(isDraw: Bool, humanWon: Bool, humanLost: Bool) -> some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            ZStack {
                // Ambient Sunburst / Aura Ring
                if humanWon {
                    Circle()
                        .stroke(
                            AngularGradient(
                                colors: [
                                    theme.ui.accent.opacity(0.4),
                                    .clear,
                                    theme.ui.accentGradient.first?.opacity(0.6) ?? theme.ui.accent.opacity(0.6),
                                    .clear,
                                    theme.ui.accent.opacity(0.4)
                                ],
                                center: .center
                            ),
                            lineWidth: 3
                        )
                        .frame(width: 140, height: 140)
                        .rotationEffect(.degrees(rotateSunburst))
                        .scaleEffect(pulseAura ? 1.08 : 0.96)

                    Circle()
                        .fill(theme.ui.accent.opacity(0.15))
                        .frame(width: 110, height: 110)
                        .blur(radius: 12)
                } else if humanLost {
                    Circle()
                        .fill(DesignTokens.Colors.danger.opacity(0.18))
                        .frame(width: 120, height: 120)
                        .scaleEffect(pulseAura ? 1.15 : 0.95)
                        .blur(radius: 16)
                }

                // Center Icon
                Image(systemName: isDraw ? "equal.circle.fill" : humanWon ? "crown.fill" : "xmark.shield.fill")
                    .font(.system(size: 72, weight: .bold))
                    .foregroundStyle(
                        isDraw
                            ? LinearGradient(colors: [DesignTokens.Colors.draw, .white], startPoint: .top, endPoint: .bottom)
                            : humanWon
                            ? LinearGradient(colors: theme.ui.accentGradient, startPoint: .top, endPoint: .bottom)
                            : LinearGradient(colors: [Color(red: 1.0, green: 0.35, blue: 0.35), DesignTokens.Colors.danger], startPoint: .top, endPoint: .bottom)
                    )
                    .shadow(
                        color: (humanWon ? theme.ui.accent : (humanLost ? DesignTokens.Colors.danger : DesignTokens.Colors.draw)).opacity(0.65),
                        radius: 20
                    )
            }
            .frame(height: 120)

            // Result Title
            Text(isDraw ? "DRAW" : humanWon ? "VICTORY!" : "DURAK!")
                .font(DesignTokens.Typography.display)
                .fontWeight(.heavy)
                .tracking(6)
                .foregroundStyle(
                    isDraw
                        ? LinearGradient(colors: [DesignTokens.Colors.draw, .white], startPoint: .leading, endPoint: .trailing)
                        : humanWon
                        ? LinearGradient(colors: theme.ui.accentGradient, startPoint: .leading, endPoint: .trailing)
                        : LinearGradient(colors: [Color(red: 1.0, green: 0.4, blue: 0.4), DesignTokens.Colors.danger], startPoint: .leading, endPoint: .trailing)
                )
                .shadow(
                    color: (humanWon ? theme.ui.accent : (humanLost ? DesignTokens.Colors.danger : DesignTokens.Colors.draw)).opacity(0.4),
                    radius: 14,
                    y: 2
                )

            // Subtitle
            if !isDraw {
                if let loserId = gameVM.game?.loserId {
                    let loserName = gameVM.names[loserId] ?? loserId
                    Text(humanLost ? "You were left holding the cards!" : "\(loserName) was left as the Durak!")
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.textMuted)
                        .tracking(1)
                }
            } else {
                Text("Both players cleared their hands simultaneously.")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
            }
        }
    }

    // MARK: - Reward / Loss Cards

    private func rewardCard(delta: Int, isDraw: Bool) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            ZStack {
                Circle()
                    .fill(theme.ui.accent.opacity(0.2))
                    .frame(width: 44, height: 44)

                Image(systemName: "creditcard.fill")
                    .font(.title3)
                    .foregroundStyle(
                        LinearGradient(
                            colors: theme.ui.accentGradient,
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("+\(delta) CREDITS")
                    .font(DesignTokens.Typography.heading)
                    .fontWeight(.bold)
                    .foregroundStyle(theme.ui.accent)

                Text(isDraw ? "Buy-in refunded" : "Match pot awarded")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
            }

            Spacer()

            Text("Total: \(EconomyStore.shared.credits)")
                .font(DesignTokens.Typography.caption)
                .fontWeight(.bold)
                .foregroundStyle(DesignTokens.Colors.textLight)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Capsule().fill(theme.ui.surfaceCard))
        }
        .padding(DesignTokens.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceCard)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.accent.opacity(0.35), lineWidth: 1)
                )
        )
    }

    private var lossCard: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            ZStack {
                Circle()
                    .fill(DesignTokens.Colors.danger.opacity(0.2))
                    .frame(width: 44, height: 44)

                Image(systemName: "creditcard.fill")
                    .font(.title3)
                    .foregroundStyle(DesignTokens.Colors.danger)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("−\(gameVM.buyIn) CREDITS")
                    .font(DesignTokens.Typography.heading)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.danger)

                Text("Buy-in lost")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
            }

            Spacer()

            Text("Total: \(EconomyStore.shared.credits)")
                .font(DesignTokens.Typography.caption)
                .fontWeight(.bold)
                .foregroundStyle(DesignTokens.Colors.textLight)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Capsule().fill(theme.ui.surfaceCard))
        }
        .padding(DesignTokens.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceCard)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(DesignTokens.Colors.danger.opacity(0.35), lineWidth: 1)
                )
        )
    }

    // MARK: - Standings Card

    private func standingsCard(game: GameState, humanLost: Bool) -> some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            HStack {
                Text("MATCH STANDINGS")
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(2)

                Spacer()

                Text("\(game.players.count) Players")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textFaint)
            }
            .padding(.horizontal, DesignTokens.Spacing.sm)

            VStack(spacing: 8) {
                ForEach(Array(game.finishedOrder.enumerated()), id: \.offset) { index, player in
                    let isHuman = player == gameVM.humanId
                    let medal = index == 0 ? "🥇" : (index == 1 ? "🥈" : (index == 2 ? "🥉" : "\(index + 1)."))

                    HStack(spacing: DesignTokens.Spacing.md) {
                        Text(medal)
                            .font(.system(size: index < 3 ? 18 : 14, weight: .bold))
                            .frame(width: 28, alignment: .center)

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(gameVM.names[player] ?? player)
                                    .font(DesignTokens.Typography.body)
                                    .fontWeight(isHuman ? .bold : .medium)
                                    .foregroundStyle(isHuman ? theme.ui.accent : DesignTokens.Colors.textLight)

                                if isHuman {
                                    Text("(You)")
                                        .font(.caption2)
                                        .foregroundStyle(theme.ui.accent)
                                }
                            }

                            Text(index == 0 ? "Winner • 1st Escaped" : "Escaped")
                                .font(.caption2)
                                .foregroundStyle(index == 0 ? theme.ui.accent : DesignTokens.Colors.textMuted)
                        }

                        Spacer()

                        if index == 0 {
                            Image(systemName: "crown.fill")
                                .font(.caption)
                                .foregroundStyle(theme.ui.accent)
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                            .fill(isHuman ? theme.ui.accent.opacity(0.12) : Color.white.opacity(0.04))
                    )
                }

                // Loser / Durak
                if let loserId = game.loserId {
                    let isHumanLoser = loserId == gameVM.humanId

                    HStack(spacing: DesignTokens.Spacing.md) {
                        Text("🃏")
                            .font(.system(size: 18))
                            .frame(width: 28, alignment: .center)

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(gameVM.names[loserId] ?? loserId)
                                    .font(DesignTokens.Typography.body)
                                    .fontWeight(.bold)
                                    .foregroundStyle(DesignTokens.Colors.danger)

                                if isHumanLoser {
                                    Text("(You)")
                                        .font(.caption2)
                                        .foregroundStyle(DesignTokens.Colors.danger)
                                }
                            }

                            Text("Durak (Left with cards)")
                                .font(.caption2)
                                .foregroundStyle(DesignTokens.Colors.danger.opacity(0.8))
                        }

                        Spacer()

                        Text("LOSER")
                            .font(.caption2)
                            .fontWeight(.heavy)
                            .foregroundStyle(DesignTokens.Colors.danger)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(DesignTokens.Colors.danger.opacity(0.18)))
                    }
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                            .fill(DesignTokens.Colors.danger.opacity(0.10))
                            .overlay(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                                    .stroke(DesignTokens.Colors.danger.opacity(0.3), lineWidth: 1)
                            )
                    )
                }
            }
        }
        .padding(DesignTokens.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.accent.opacity(0.25), lineWidth: 1)
                )
        )
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button {
                Task {
                    let started = await gameVM.startSoloGame()
                    await MainActor.run {
                        guard started else { return }
                        router.navigate(to: .game)
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.headline)
                    Text("PLAY AGAIN")
                        .font(DesignTokens.Typography.heading)
                        .tracking(2)
                }
                .foregroundStyle(theme.ui.accentText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(
                        colors: theme.ui.accentGradient,
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                )
                .shadow(color: theme.ui.accent.opacity(0.45), radius: 12, y: 4)
            }
            .buttonStyle(.springPressable(feedback: .gameStart))
            .disabled(!EconomyStore.shared.canAffordCredits(gameVM.buyIn))
            .opacity(EconomyStore.shared.canAffordCredits(gameVM.buyIn) ? 1 : 0.45)

            Button {
                gameVM.goHome()
                router.navigate(to: .home)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "house.fill")
                        .font(.subheadline)
                    Text("MAIN MENU")
                        .font(DesignTokens.Typography.body)
                        .tracking(1)
                }
                .foregroundStyle(DesignTokens.Colors.textLight)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.accent.opacity(0.28), lineWidth: 1)
                )
            }
            .buttonStyle(.springPressable(feedback: .uiTap))
        }
    }
}
