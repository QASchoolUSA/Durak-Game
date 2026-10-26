import SwiftUI

/// Compact icon-only HUD button opening the Emoji reactions drawer.
struct EmojiButton: View {
    @Environment(ThemeManager.self) private var theme
    var onTap: () -> Void

    private var btnSize: CGFloat { DesignTokens.Layout.chromeButtonSize }
    private var iconSize: CGFloat { DesignTokens.Layout.isPadOrMac ? 24 : 21 }

    var body: some View {
        Button {
            onTap()
        } label: {
            Circle()
                .fill(theme.ui.surfaceGlass)
                .frame(width: btnSize, height: btnSize)
                .overlay(
                    Circle()
                        .stroke(theme.ui.accent.opacity(0.40), lineWidth: 1.2)
                )
                .overlay(
                    Image(systemName: "face.smiling.inverse")
                        .font(.system(size: iconSize, weight: .bold))
                        .foregroundStyle(theme.ui.accent)
                )
                .shadow(color: Color.black.opacity(0.35), radius: 6, y: 3)
        }
        .buttonStyle(.springPressable(scale: 0.90, feedback: .selection))
    }
}
