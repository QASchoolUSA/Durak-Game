import SwiftUI

/// Rules / How to Play modal.
///
/// Port of `RulesModal.tsx`.
struct RulesView: View {
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                // Background matching active table theme
                LinearGradient(
                    colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    ruleSection(
                        title: "Objective",
                        body: "Get rid of all your cards. The last player holding cards is the Durak (fool)."
                    )

                    ruleSection(
                        title: "Setup",
                        body: "A 36-card deck (6 through Ace) is used. Each player is dealt 6 cards. The bottom card of the deck determines the trump suit."
                    )

                    ruleSection(
                        title: "Attacking",
                        body: "The attacker plays any card from their hand. Other players may throw in cards of matching ranks. The defender must beat each attack card."
                    )

                    ruleSection(
                        title: "Defending",
                        body: "To beat an attack, play a higher card of the same suit, or any trump card against a non-trump attack. Higher trumps beat lower trumps."
                    )

                    ruleSection(
                        title: "Taking",
                        body: "If you can't beat all attacks, press TAKE to collect all table cards into your hand. The attacker may throw in more cards before you take."
                    )

                    ruleSection(
                        title: "Perevodnoy (Transfer)",
                        body: "In Perevodnoy variant, the defender may play a card of the same rank as the attack to transfer the defense to the next player."
                    )

                    ruleSection(
                        title: "Drawing",
                        body: "After each round, players draw from the deck (attacker first, defender last) until everyone has 6 cards or the deck is empty."
                    )

                    ruleSection(
                        title: "Winning",
                        body: "Once the deck is empty, players who empty their hand are safe. The last player holding cards loses — they are the Durak!"
                    )
                }
                .padding(DesignTokens.Spacing.xl)
            }
        }
        .navigationTitle("How to Play")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                        .foregroundStyle(theme.ui.accent)
                }
            }
        }
    }

    @ViewBuilder
    private func ruleSection(title: String, body: String) -> some View {
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
