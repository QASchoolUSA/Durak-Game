import SwiftUI

/// Top-bar chip displaying Gold coin and Credit balances.
struct EconomyBar: View {
    @Environment(ThemeManager.self) private var theme
    @State private var economy = EconomyStore.shared

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Gold
            HStack(spacing: 4) {
                Text("🪙")
                    .font(.system(size: 14))
                Text("\(economy.gold)")
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(theme.ui.accent)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(theme.ui.surfaceGlass)
                    .overlay(Capsule().stroke(theme.ui.accent.opacity(0.4), lineWidth: 1))
            )

            // Credits
            HStack(spacing: 4) {
                Image(systemName: "suit.diamond.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(DesignTokens.Colors.redCard)
                Text("\(economy.credits)")
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textLight)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(theme.ui.surfaceGlass)
                    .overlay(Capsule().stroke(Color.white.opacity(0.15), lineWidth: 1))
            )
        }
    }
}
