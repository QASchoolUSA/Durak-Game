import SwiftUI

/// Bottom sheet of static Noto reaction glyphs; animation plays in-game after select.
struct EmojiPickerSheet: View {
    @Environment(ThemeManager.self) private var theme
    var onSelectEmoji: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    private var stickers: [ReactionSticker] {
        ReactionCatalog.allNoto
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
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 52), spacing: 10)],
                        spacing: 10
                    ) {
                        ForEach(stickers) { sticker in
                            Button {
                                dismiss()
                                onSelectEmoji(sticker.token)
                            } label: {
                                NotoPickerCell(sticker: sticker)
                            }
                            .buttonStyle(.springPressable(scale: 0.88, feedback: .selection))
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
            Text("Reactions")
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
        .padding(.bottom, DesignTokens.Spacing.sm)
    }
}
