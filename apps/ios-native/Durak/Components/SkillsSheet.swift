import SwiftUI
import DurakGameCore

/// Unified drawer presenting tactical abilities with live currency balances.
struct SkillsSheet: View {
    @Environment(ThemeManager.self) private var theme
    var gameVM: GameViewModel
    var onReveal: () -> Void
    var onGraveyard: () -> Void
    var onHint: () -> Void
    var onUndo: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var economy = EconomyStore.shared

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: DesignTokens.Spacing.md) {
                        // Currency balance card
                        currencyCard

                        // Skills list
                        VStack(spacing: DesignTokens.Spacing.sm) {
                            // 1. Reveal Hand (solo only — online hands are sanitized placeholders)
                            skillRow(
                                icon: "eye.fill",
                                iconColor: Color.cyan,
                                title: "Peek Opponent Hand",
                                subtitle: gameVM.playMode == .online
                                    ? "Available in solo games only"
                                    : "Reveal opponent's cards for this turn",
                                costText: "2 🪙",
                                isEnabled: gameVM.playMode == .solo
                                    && economy.canAffordGold(EconomyStore.revealGoldCost)
                            ) {
                                guard gameVM.playMode == .solo else {
                                    FeedbackManager.shared.trigger(.failure)
                                    return
                                }
                                if economy.spendGold(EconomyStore.revealGoldCost) {
                                    FeedbackManager.shared.trigger(.confirm)
                                    dismiss()
                                    onReveal()
                                } else {
                                    FeedbackManager.shared.trigger(.failure)
                                }
                            }

                            // 2. Graveyard Discard
                            skillRow(
                                icon: "archivebox.fill",
                                iconColor: theme.ui.accent,
                                title: "Inspect Discard Pile",
                                subtitle: "Browse played cards to track remaining trumps",
                                costText: "1 🪙",
                                isEnabled: economy.canAffordGold(EconomyStore.graveyardGoldCost)
                            ) {
                                if economy.spendGold(EconomyStore.graveyardGoldCost) {
                                    FeedbackManager.shared.trigger(.confirm)
                                    dismiss()
                                    onGraveyard()
                                } else {
                                    FeedbackManager.shared.trigger(.failure)
                                }
                            }

                            // 3. Strategic Move Hint
                            skillRow(
                                icon: "lightbulb.fill",
                                iconColor: Color.yellow,
                                title: "Strategic Move Hint",
                                subtitle: "Analyze board and get best card recommendation",
                                costText: "1 🪙",
                                isEnabled: economy.canAffordGold(EconomyStore.hintGoldCost)
                            ) {
                                if economy.spendGold(EconomyStore.hintGoldCost) {
                                    FeedbackManager.shared.trigger(.confirm)
                                    dismiss()
                                    onHint()
                                } else {
                                    FeedbackManager.shared.trigger(.failure)
                                }
                            }

                            // 4. Undo Move
                            skillRow(
                                icon: "arrow.uturn.backward.circle.fill",
                                iconColor: Color.orange,
                                title: "Undo Last Card",
                                subtitle: gameVM.canReturn
                                    ? "Active: Take back your recently played card"
                                    : "Available for 3 seconds after playing a card",
                                costText: "Free",
                                isEnabled: gameVM.canReturn
                            ) {
                                if gameVM.canReturn {
                                    FeedbackManager.shared.trigger(.confirm)
                                    dismiss()
                                    onUndo()
                                }
                            }
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.vertical, DesignTokens.Spacing.md)
                }
            }
            .navigationTitle("Skills & Tactics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title3)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                    }
                }
            }
        }
    }

    // MARK: - Currency Header Card

    private var currencyCard: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Gold
            HStack(spacing: 8) {
                Text("🪙")
                    .font(.system(size: 24))
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(economy.gold)")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(theme.ui.accent)
                    Text("Gold (Skills)")
                        .font(DesignTokens.Typography.captionSmall)
                        .foregroundStyle(DesignTokens.Colors.textMuted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(theme.ui.surfaceGlass)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(theme.ui.accent.opacity(0.4), lineWidth: 1))
            )

            // Credits
            HStack(spacing: 8) {
                Image(systemName: "suit.diamond.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(DesignTokens.Colors.redCard)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(economy.credits)")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(DesignTokens.Colors.textLight)
                    Text("Credits (Stakes)")
                        .font(DesignTokens.Typography.captionSmall)
                        .foregroundStyle(DesignTokens.Colors.textMuted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(theme.ui.surfaceGlass)
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.15), lineWidth: 1))
            )
        }
    }

    // MARK: - Skill Row Builder

    private func skillRow(
        icon: String,
        iconColor: Color,
        title: String,
        subtitle: String,
        costText: String,
        isEnabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                // Circular icon
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(isEnabled ? iconColor : DesignTokens.Colors.textFaint)
                    .frame(width: 42, height: 42)
                    .background(
                        Circle()
                            .fill(isEnabled ? iconColor.opacity(0.15) : Color.white.opacity(0.04))
                    )

                // Title + Subtitle
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(DesignTokens.Typography.heading)
                        .foregroundStyle(isEnabled ? DesignTokens.Colors.textLight : DesignTokens.Colors.textFaint)

                    Text(subtitle)
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(isEnabled ? DesignTokens.Colors.textMuted : DesignTokens.Colors.textFaint.opacity(0.7))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }

                Spacer()

                // Cost badge
                Text(costText)
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(isEnabled ? theme.ui.accent : DesignTokens.Colors.textFaint)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule()
                            .fill(isEnabled ? theme.ui.accent.opacity(0.12) : Color.white.opacity(0.05))
                            .overlay(Capsule().stroke(isEnabled ? theme.ui.accent.opacity(0.35) : Color.clear, lineWidth: 1))
                    )
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(theme.ui.surfaceGlass)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(isEnabled ? Color.white.opacity(0.12) : Color.white.opacity(0.04), lineWidth: 1)
                    )
            )
        }
        .disabled(!isEnabled)
        .buttonStyle(SkillRowButtonStyle())
    }
}

private struct SkillRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}
