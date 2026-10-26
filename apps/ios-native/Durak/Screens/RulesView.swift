import SwiftUI

/// Rules / How to Play modal.
///
/// Port of `RulesModal.tsx`.
struct RulesView: View {
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            // Background matching active table theme
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                sheetHeader

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                        ruleSection(
                            title: "Objective",
                            body: String(localized: "Get rid of all your cards. The last player holding cards is the Durak (fool).")
                        )

                        ruleSection(
                            title: "Setup",
                            body: String(localized: "A 36-card deck (6–Ace). Each player is dealt 6 cards. The bottom card sets the trump suit. The holder of the lowest trump attacks first.")
                        )

                        ruleSection(
                            title: "Attacking",
                            body: String(localized: "Play any card to open. Others (except the defender) may throw in cards matching any rank already on the table — attack or defense.\n\nCaps: at most 5 attacking cards until the first successful discard, then 6. Never more attacking cards than the defender held when the bout began.")
                        )

                        ruleSection(
                            title: "Defending",
                            body: String(localized: "Beat each attack with a higher card of the same suit, or any trump vs a non-trump. A trump is beaten only by a higher trump.")
                        )

                        ruleSection(
                            title: "Taking",
                            body: String(localized: "Press TAKE when you will not (or cannot) cover every attack. Attackers may still throw in matching ranks afterward (вдогонку), within the same caps. Then you pick up the whole table and skip the next attack — the player to your left attacks.")
                        )

                        ruleSection(
                            title: "Perevodnoy (Transfer)",
                            body: String(localized: "Before covering anything, you may add a card of the same rank and pass the whole uncovered pile to the next player. They may transfer again the same way.\n\nSame-rank adds from attackers keep the transfer window open. Any defense closes it.\n\nYou cannot transfer more cards than the next player holds. By default, transfers are off until the first successful discard (первый ход не переводят).")
                        )

                        ruleSection(
                            title: "Drawing",
                            body: String(localized: "After each bout, refill to 6: attacker first, then others clockwise, defender last. If the defender took, they skip the draw.")
                        )

                        ruleSection(
                            title: "Winning",
                            body: String(localized: "Once the deck is empty, emptying your hand takes you out. Last player with cards is the Durak. If nobody holds cards, it is a draw.")
                        )

                        ruleSection(
                            title: "House rules in this app",
                            body: String(localized: "Throw-in scope can be All players or Neighbors only. Trump-6 ↔ face-up trump swap is not used. Partnership teams are not supported.")
                        )
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxContentWidth)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.xs)
                    .padding(.bottom, DesignTokens.Spacing.xl)
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private var sheetHeader: some View {
        HStack {
            Color.clear.frame(width: 50, height: 32)
            Spacer()
            Text("How to Play")
                .font(DesignTokens.Typography.heading)
                .foregroundStyle(DesignTokens.Colors.textLight)
            Spacer()
            Button("Done") {
                dismiss()
            }
            .font(DesignTokens.Typography.body)
            .fontWeight(.semibold)
            .foregroundStyle(theme.ui.accent)
            .frame(width: 50, alignment: .trailing)
            .buttonStyle(.springPressable(scale: 0.94, feedback: .uiTap))
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.md)
        .padding(.bottom, DesignTokens.Spacing.sm)
    }

    @ViewBuilder
    private func ruleSection(title: LocalizedStringKey, body: String) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(title)
                .font(DesignTokens.Typography.heading)
                .foregroundStyle(theme.ui.accent)

            Text(body)
                .font(DesignTokens.Typography.body)
                .foregroundStyle(DesignTokens.Colors.textLight)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.accent.opacity(0.18), lineWidth: 1)
                )
        )
    }
}
