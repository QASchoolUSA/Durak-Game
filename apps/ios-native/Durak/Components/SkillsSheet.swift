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
    @State private var isSpending = false

    /// Skills mode: abilities are free (matches RN + Convex rooms).
    private var abilitiesMode: Bool {
        if let style = gameVM.game?.rules.playStyle {
            return style == .abilities
        }
        return gameVM.playStyle == .abilities
    }

    private func costLabel(_ amount: Int) -> String {
        abilitiesMode || amount <= 0 ? String(localized: "Free") : "\(amount) 🪙"
    }

    private func canAfford(_ amount: Int) -> Bool {
        abilitiesMode || amount <= 0 || economy.canAffordGold(amount)
    }

    private func spendIfNeeded(_ amount: Int, reason: String, then action: @escaping () -> Void) {
        guard !isSpending else { return }
        if abilitiesMode || amount <= 0 {
            FeedbackManager.shared.trigger(.confirm)
            dismiss()
            action()
            return
        }
        isSpending = true
        Task { @MainActor in
            let ok = await economy.spendGoldSynced(amount, reason: reason)
            isSpending = false
            if ok {
                dismiss()
                action()
            } else {
                FeedbackManager.shared.trigger(.failure)
            }
        }
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                sheetHeader

                ScrollView(showsIndicators: false) {
                    VStack(spacing: DesignTokens.Spacing.md) {
                        currencyCard

                        VStack(spacing: DesignTokens.Spacing.sm) {
                            skillRow(
                                icon: "eye.fill",
                                iconColor: Color.cyan,
                                title: String(localized: "Peek Opponent Hand"),
                                subtitle: gameVM.playMode == .online
                                    ? String(localized: "Available in solo games only")
                                    : String(localized: "Reveal opponent's cards for this turn"),
                                costText: costLabel(EconomyStore.revealGoldCost),
                                isEnabled: gameVM.playMode == .solo
                                    && canAfford(EconomyStore.revealGoldCost)
                                    && !isSpending
                            ) {
                                guard gameVM.playMode == .solo else {
                                    FeedbackManager.shared.trigger(.failure)
                                    return
                                }
                                spendIfNeeded(
                                    EconomyStore.revealGoldCost,
                                    reason: "reveal_hand"
                                ) {
                                    onReveal()
                                }
                            }

                            skillRow(
                                icon: "archivebox.fill",
                                iconColor: theme.ui.accent,
                                title: String(localized: "Inspect Discard Pile"),
                                subtitle: String(localized: "Browse played cards to track remaining trumps"),
                                costText: costLabel(EconomyStore.graveyardGoldCost),
                                isEnabled: canAfford(EconomyStore.graveyardGoldCost) && !isSpending
                            ) {
                                spendIfNeeded(
                                    EconomyStore.graveyardGoldCost,
                                    reason: "graveyard"
                                ) {
                                    onGraveyard()
                                }
                            }

                            skillRow(
                                icon: "lightbulb.fill",
                                iconColor: Color.yellow,
                                title: String(localized: "Strategic Move Hint"),
                                subtitle: String(localized: "Analyze board and get best card recommendation"),
                                costText: costLabel(EconomyStore.hintGoldCost),
                                isEnabled: canAfford(EconomyStore.hintGoldCost) && !isSpending
                            ) {
                                spendIfNeeded(
                                    EconomyStore.hintGoldCost,
                                    reason: "hint"
                                ) {
                                    onHint()
                                }
                            }

                            skillRow(
                                icon: "arrow.uturn.backward.circle.fill",
                                iconColor: Color.orange,
                                title: String(localized: "Undo Last Card"),
                                subtitle: gameVM.canReturn
                                    ? String(localized: "Active: Take back your recently played card")
                                    : String(localized: "Available shortly after playing a card"),
                                costText: String(localized: "Free"),
                                isEnabled: gameVM.canReturn && !isSpending
                            ) {
                                if gameVM.canReturn {
                                    dismiss()
                                    onUndo()
                                }
                            }
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.bottom, DesignTokens.Spacing.md)
                }
            }
        }
    }

    private var sheetHeader: some View {
        HStack {
            Color.clear.frame(width: 32, height: 32)
            Spacer()
            Text("Skills & Tactics")
                .font(DesignTokens.Typography.heading)
                .foregroundStyle(DesignTokens.Colors.textLight)
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.springPressable(scale: 0.90, feedback: .uiTap))
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.top, DesignTokens.Spacing.md)
        .padding(.bottom, DesignTokens.Spacing.xs)
    }

    // MARK: - Currency Header Card

    private var currencyCard: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            HStack(spacing: 8) {
                Text("🪙")
                    .font(.system(size: 24))
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(economy.gold)")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(theme.ui.accent)
                    Text(abilitiesMode
                         ? String(localized: "Gold (free skills)")
                         : String(localized: "Gold (Skills)"))
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

            HStack(spacing: 8) {
                Image(systemName: "suit.diamond.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(DesignTokens.Colors.redCard)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(economy.credits)")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(DesignTokens.Colors.textLight)
                    Text(String(localized: "Credits (Stakes)"))
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
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(isEnabled ? iconColor : DesignTokens.Colors.textFaint)
                    .frame(width: 42, height: 42)
                    .background(
                        Circle()
                            .fill(isEnabled ? iconColor.opacity(0.15) : Color.white.opacity(0.04))
                    )

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
        .buttonStyle(.springPressable(scale: 0.97, feedback: .confirm))
    }
}
