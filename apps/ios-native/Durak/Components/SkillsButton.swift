import SwiftUI

/// Compact icon-only HUD button opening the Skills & Tactics drawer.
struct SkillsButton: View {
    @Environment(ThemeManager.self) private var theme
    var onTap: () -> Void
    @State private var economy = EconomyStore.shared

    private var btnSize: CGFloat { DesignTokens.Layout.chromeButtonSize }
    private var iconSize: CGFloat { DesignTokens.Layout.isPadOrMac ? 22 : 19 }

    var body: some View {
        Button {
            onTap()
        } label: {
            ZStack(alignment: .topTrailing) {
                // Circular glass button
                Circle()
                    .fill(theme.ui.surfaceGlass)
                    .frame(width: btnSize, height: btnSize)
                    .overlay(
                        Circle()
                            .stroke(theme.ui.accent.opacity(0.40), lineWidth: 1.2)
                    )
                    .overlay(
                        Image(systemName: "wand.and.stars")
                            .font(.system(size: iconSize, weight: .bold))
                            .foregroundStyle(theme.ui.accent)
                    )
                    .shadow(color: Color.black.opacity(0.35), radius: 6, y: 3)

                // Micro gold coin badge
                if economy.gold > 0 {
                    HStack(spacing: 1) {
                        Text("\(economy.gold)")
                            .font(.system(size: DesignTokens.Layout.isPadOrMac ? 10 : 9, weight: .heavy))
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
        .buttonStyle(.springPressable(scale: 0.90, feedback: .selection))
    }
}
