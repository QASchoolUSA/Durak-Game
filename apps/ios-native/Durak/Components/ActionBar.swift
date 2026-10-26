import SwiftUI
import DurakGameCore

/// Bottom action bar providing Take, Done/Pass, and Return (undo) buttons.
struct ActionBar: View {
    @Environment(ThemeManager.self) private var theme
    var gameVM: GameViewModel

    private var isWide: Bool { DesignTokens.Layout.isPadOrMac }
    private var pillHeight: CGFloat { isWide ? 50 : 44 }
    private var fontSize: CGFloat { isWide ? 18 : 16 }
    private var iconSize: CGFloat { isWide ? 17 : 15 }

    var body: some View {
        HStack(spacing: isWide ? 16 : 12) {
            // Return (Undo) button
            if gameVM.canReturn {
                Button {
                    gameVM.returnLastCard()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.uturn.backward")
                            .font(.system(size: iconSize, weight: .bold))
                        Text("Undo")
                            .font(.system(size: fontSize, weight: .bold))
                    }
                    .foregroundStyle(theme.ui.accent)
                    .padding(.horizontal, isWide ? 22 : 18)
                    .frame(height: pillHeight)
                    .background(
                        Capsule()
                            .fill(theme.ui.surfaceGlass)
                            .overlay(
                                Capsule().stroke(theme.ui.accent, lineWidth: 1.5)
                            )
                    )
                }
                .buttonStyle(.springPressable(feedback: .confirm))
                .transition(.scale.combined(with: .opacity))
            }

            // Take button (for defender)
            if gameVM.canTake() {
                Button {
                    guard !gameVM.isSubmittingOnlineMove else { return }
                    // Draw/take SFX plays from GameScene with the sweep animation — press feedback handles tap.
                    gameVM.submitHuman(.take(player: gameVM.humanId))
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "hand.raised.fill")
                            .font(.system(size: iconSize, weight: .bold))
                        Text("Take")
                            .font(.system(size: fontSize, weight: .bold))
                    }
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, isWide ? 28 : 22)
                    .frame(height: pillHeight)
                    .background(
                        Capsule()
                            .fill(LinearGradient(colors: [Color.orange, Color.red], startPoint: .top, endPoint: .bottom))
                            .shadow(color: Color.red.opacity(0.4), radius: 8, y: 3)
                    )
                }
                .disabled(gameVM.isSubmittingOnlineMove)
                .buttonStyle(.springPressable(feedback: .selection))
                .transition(.scale.combined(with: .opacity))
            }

            // Pass / Done button (for attacker / throw-in)
            if gameVM.canPass() {
                Button {
                    guard !gameVM.isSubmittingOnlineMove else { return }
                    gameVM.submitHuman(.pass(player: gameVM.humanId))
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: iconSize, weight: .bold))
                        Text("Done")
                            .font(.system(size: fontSize, weight: .bold))
                    }
                    .foregroundStyle(theme.ui.accentText)
                    .padding(.horizontal, isWide ? 28 : 22)
                    .frame(height: pillHeight)
                    .background(
                        Capsule()
                            .fill(LinearGradient(colors: theme.ui.accentGradient, startPoint: .top, endPoint: .bottom))
                            .shadow(color: theme.ui.accent.opacity(0.4), radius: 8, y: 3)
                    )
                }
                .disabled(gameVM.isSubmittingOnlineMove)
                .buttonStyle(.springPressable(feedback: .confirm))
                .transition(.scale.combined(with: .opacity))
            }
        }
        .opacity(gameVM.isSubmittingOnlineMove ? 0.55 : 1)
        .animation(.interactiveSpring(response: 0.24, dampingFraction: 0.78), value: gameVM.canReturn)
        .animation(.interactiveSpring(response: 0.24, dampingFraction: 0.78), value: gameVM.canTake())
        .animation(.interactiveSpring(response: 0.24, dampingFraction: 0.78), value: gameVM.canPass())
        .animation(.easeInOut(duration: 0.2), value: gameVM.isSubmittingOnlineMove)
    }
}
