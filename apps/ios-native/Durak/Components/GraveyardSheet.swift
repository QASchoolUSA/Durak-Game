import SwiftUI
import DurakGameCore

/// Sheet displaying discarded cards (Graveyard).
struct GraveyardSheet: View {
    @Environment(ThemeManager.self) private var theme
    let discardPile: [Card]
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

            VStack(spacing: 0) {
                HStack {
                    Color.clear.frame(width: 50, height: 32)
                    Spacer()
                    Text("Graveyard (\(discardPile.count))")
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

                if discardPile.isEmpty {
                    Spacer()
                    VStack(spacing: DesignTokens.Spacing.md) {
                        Image(systemName: "archivebox")
                            .font(.system(size: 48))
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                        Text("Graveyard is empty")
                            .font(DesignTokens.Typography.body)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                    }
                    Spacer()
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 55))], spacing: DesignTokens.Spacing.sm) {
                            ForEach(discardPile) { card in
                                CardThumbnail(card: card, isTrump: card.suit == trumpSuit, trumpHighlightColor: theme.ui.accent)
                            }
                        }
                        .padding(DesignTokens.Spacing.lg)
                    }
                }
            }
        }
    }
}

private struct CardThumbnail: View {
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
        VStack(spacing: 2) {
            Text(rankText)
                .font(.system(size: 13, weight: .bold))
            Text(suitText)
                .font(.system(size: 15, weight: .bold))
        }
        .foregroundStyle(isRed ? DesignTokens.Colors.redCard : DesignTokens.Colors.blackCard)
        .frame(width: 52, height: 72)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(hex: "#FAF7F0"))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(isTrump ? trumpHighlightColor : Color.gray.opacity(0.3), lineWidth: isTrump ? 2 : 1)
                )
        )
    }
}
