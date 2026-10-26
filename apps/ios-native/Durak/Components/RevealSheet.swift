import SwiftUI
import DurakGameCore

/// Sheet revealing opponent hand cards.
struct RevealSheet: View {
    @Environment(ThemeManager.self) private var theme
    let opponentName: String
    let cards: [Card]
    let trumpSuit: Suit
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: DesignTokens.Spacing.md) {
                HStack {
                    Color.clear.frame(width: 50, height: 32)
                    Spacer()
                    Text("Reveal Cards")
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

                Text("Peeking into \(opponentName)'s hand")
                    .font(DesignTokens.Typography.body)
                    .foregroundStyle(DesignTokens.Colors.textMuted)

                ScrollView(showsIndicators: false) {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 58))], spacing: DesignTokens.Spacing.sm) {
                        ForEach(cards) { card in
                            RevealedCardView(card: card, isTrump: card.suit == trumpSuit, trumpHighlightColor: theme.ui.accent)
                        }
                    }
                    .padding(DesignTokens.Spacing.lg)
                }

                Button {
                    dismiss()
                } label: {
                    Text("Close")
                        .font(DesignTokens.Typography.button)
                        .foregroundStyle(theme.ui.accentText)
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .background(
                            Capsule()
                                .fill(
                                    LinearGradient(
                                        colors: theme.ui.accentGradient,
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                        )
                        .shadow(color: theme.ui.accent.opacity(0.4), radius: 8, y: 3)
                }
                .buttonStyle(.springPressable(feedback: .uiTap))
                .padding(.bottom, DesignTokens.Spacing.md)
            }
        }
    }
}

private struct RevealedCardView: View {
    let card: Card
    let isTrump: Bool
    var trumpHighlightColor: Color = DesignTokens.Colors.gold

    var isRed: Bool { card.suit == .hearts || card.suit == .diamonds }

    var rankText: String {
        switch card.rank {
        case .six: return "6"
        case .seven: return "7"
        case .eight: return "8"
        case .nine: return "9"
        case .ten: return "10"
        case .jack: return "J"
        case .queen: return "Q"
        case .king: return "K"
        case .ace: return "A"
        }
    }

    var suitText: String {
        switch card.suit {
        case .spades: return "♠"
        case .hearts: return "♥"
        case .diamonds: return "♦"
        case .clubs: return "♣"
        }
    }

    var body: some View {
        VStack(spacing: 3) {
            Text(rankText)
                .font(.system(size: 14, weight: .bold))
            Text(suitText)
                .font(.system(size: 18, weight: .bold))
        }
        .foregroundStyle(isRed ? DesignTokens.Colors.redCard : DesignTokens.Colors.blackCard)
        .frame(width: 58, height: 80)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(hex: "#FAF7F0"))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isTrump ? trumpHighlightColor : Color.gray.opacity(0.3), lineWidth: isTrump ? 2 : 1)
                )
        )
    }
}
