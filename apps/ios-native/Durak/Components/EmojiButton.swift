import SwiftUI

/// Compact icon-only HUD button opening the Emoji reactions drawer.
struct EmojiButton: View {
    @Environment(ThemeManager.self) private var theme
    var onTap: () -> Void

    var body: some View {
        Button {
            FeedbackManager.shared.trigger(.selection)
            onTap()
        } label: {
            Circle()
                .fill(theme.ui.surfaceGlass)
                .frame(width: 44, height: 44)
                .overlay(
                    Circle()
                        .stroke(theme.ui.accent.opacity(0.35), lineWidth: 1.2)
                )
                .overlay(
                    Image(systemName: "face.smiling.inverse")
                        .font(.system(size: 21, weight: .bold))
                        .foregroundStyle(theme.ui.accent)
                )
                .shadow(color: Color.black.opacity(0.35), radius: 6, y: 3)
        }
        .buttonStyle(EmojiBounceStyle())
    }
}

private struct EmojiBounceStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.90 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.65), value: configuration.isPressed)
    }
}
