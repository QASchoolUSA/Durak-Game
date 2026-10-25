import SwiftUI
import DurakGameCore

/// Bottom action bar providing Take, Done/Pass, and Return (undo) buttons.
struct ActionBar: View {
    @Environment(ThemeManager.self) private var theme
    var gameVM: GameViewModel

    var body: some View {
        HStack(spacing: 12) {
            // Return (Undo) button
            if gameVM.canReturn {
                Button {
                    FeedbackManager.shared.trigger(.confirm)
                    gameVM.returnLastCard()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.uturn.backward")
                            .font(.system(size: 15, weight: .bold))
                        Text("Undo")
                            .font(.system(size: 16, weight: .bold))
                    }
                    .foregroundStyle(theme.ui.accent)
                    .padding(.horizontal, 18)
                    .frame(height: 44)
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
                    FeedbackManager.shared.trigger(.takeCards)
                    gameVM.submitHuman(.take(player: gameVM.humanId))
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "hand.raised.fill")
                            .font(.system(size: 15, weight: .bold))
                        Text("Take")
                            .font(.system(size: 16, weight: .bold))
                    }
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(
                        Capsule()
                            .fill(LinearGradient(colors: [Color.orange, Color.red], startPoint: .top, endPoint: .bottom))
                            .shadow(color: Color.red.opacity(0.4), radius: 8, y: 3)
                    )
                }
                .buttonStyle(.springPressable(feedback: .takeCards))
                .transition(.scale.combined(with: .opacity))
            }

            // Pass / Done button (for attacker / throw-in)
            if gameVM.canPass() {
                Button {
                    FeedbackManager.shared.trigger(.confirm)
                    gameVM.submitHuman(.pass(player: gameVM.humanId))
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 15, weight: .bold))
                        Text("Done")
                            .font(.system(size: 16, weight: .bold))
                    }
                    .foregroundStyle(theme.ui.accentText)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(
                        Capsule()
                            .fill(LinearGradient(colors: theme.ui.accentGradient, startPoint: .top, endPoint: .bottom))
                            .shadow(color: theme.ui.accent.opacity(0.4), radius: 8, y: 3)
                    )
                }
                .buttonStyle(.springPressable(feedback: .confirm))
                .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.75), value: gameVM.canReturn)
        .animation(.spring(response: 0.35, dampingFraction: 0.75), value: gameVM.canTake())
        .animation(.spring(response: 0.35, dampingFraction: 0.75), value: gameVM.canPass())
    }
}
