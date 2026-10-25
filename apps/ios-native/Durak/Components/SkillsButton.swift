import SwiftUI

/// Compact icon-only HUD button opening the Skills & Tactics drawer.
struct SkillsButton: View {
    @Environment(ThemeManager.self) private var theme
    var onTap: () -> Void
    @State private var economy = EconomyStore.shared

    var body: some View {
        Button {
            FeedbackManager.shared.trigger(.selection)
            onTap()
        } label: {
            ZStack(alignment: .topTrailing) {
                // Circular glass button
                Circle()
                    .fill(theme.ui.surfaceGlass)
                    .frame(width: 44, height: 44)
                    .overlay(
                        Circle()
                            .stroke(theme.ui.accent.opacity(0.45), lineWidth: 1.2)
                    )
                    .overlay(
                        Image(systemName: "wand.and.stars")
                            .font(.system(size: 19, weight: .bold))
                            .foregroundStyle(theme.ui.accent)
                    )
                    .shadow(color: Color.black.opacity(0.35), radius: 6, y: 3)

                // Micro gold coin badge
                if economy.gold > 0 {
                    HStack(spacing: 1) {
                        Text("\(economy.gold)")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(theme.ui.accentText)
                    }
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(LinearGradient(colors: theme.ui.accentGradient, startPoint: .top, endPoint: .bottom))
                    )
                    .offset(x: 4, y: -2)
                }
            }
        }
        .buttonStyle(SkillsButtonStyle())
    }
}

private struct SkillsButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.90 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.65), value: configuration.isPressed)
    }
}
