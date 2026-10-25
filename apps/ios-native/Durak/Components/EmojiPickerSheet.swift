import SwiftUI

/// Bottom sheet presenting an expanded gallery of animated emoji reactions.
struct EmojiPickerSheet: View {
    @Environment(ThemeManager.self) private var theme
    var onSelectEmoji: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    private struct EmojiCategory: Identifiable {
        let id: String
        let title: String
        let emojis: [String]
    }

    private let categories: [EmojiCategory] = [
        EmojiCategory(
            id: "reactions",
            title: "Reactions & Praise",
            emojis: ["👍", "👎", "🔥", "👑", "👏", "🏆", "💯", "🤝", "🎯", "⚡️"]
        ),
        EmojiCategory(
            id: "emotions",
            title: "Expressions & Taunts",
            emojis: ["😂", "😭", "🤯", "🥳", "😈", "🥶", "😱", "🤫", "🤡", "🥱", "🧐", "🫡", "🤩", "🫠"]
        ),
        EmojiCategory(
            id: "cards",
            title: "Card Luck & Tactics",
            emojis: ["♠️", "♥️", "♦️", "♣️", "🍀", "🃏", "🎲", "🪙", "🛡️", "⚔️", "💣"]
        )
    ]

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
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                        ForEach(categories) { category in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(category.title)
                                    .font(DesignTokens.Typography.caption)
                                    .fontWeight(.bold)
                                    .foregroundStyle(theme.ui.accent)
                                    .textCase(.uppercase)

                                LazyVGrid(
                                    columns: [GridItem(.adaptive(minimum: 46), spacing: 10)],
                                    spacing: 10
                                ) {
                                    ForEach(category.emojis, id: \.self) { emoji in
                                        Button {
                                            FeedbackManager.shared.trigger(.selection)
                                            dismiss()
                                            onSelectEmoji(emoji)
                                        } label: {
                                            Text(emoji)
                                                .font(.system(size: 26))
                                                .fixedSize()
                                                .frame(width: 48, height: 48)
                                                .background(
                                                    RoundedRectangle(cornerRadius: 12)
                                                        .fill(theme.ui.surfaceGlass)
                                                        .overlay(
                                                            RoundedRectangle(cornerRadius: 12)
                                                                .stroke(Color.white.opacity(0.12), lineWidth: 1)
                                                        )
                                                )
                                        }
                                        .buttonStyle(EmojiGridButtonStyle())
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.vertical, DesignTokens.Spacing.md)
                }
            }
            .navigationTitle("Reactions")
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
}

private struct EmojiGridButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.88 : 1.0)
            .animation(.spring(response: 0.22, dampingFraction: 0.65), value: configuration.isPressed)
    }
}
