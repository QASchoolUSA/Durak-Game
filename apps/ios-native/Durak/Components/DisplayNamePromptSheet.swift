import SwiftUI

/// One-shot display-name collector shown after Sign in with Apple when Apple did not provide a name
/// (Hide My Name, empty components, cleared Keychain, or Simulator without a guest nickname).
struct DisplayNamePromptSheet: View {
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    var onCompleted: (() -> Void)? = nil

    @State private var nameDraft: String = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String? = nil
    @FocusState private var focused: Bool

    private var canSubmit: Bool {
        nameDraft.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
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
                HStack {
                    Spacer()
                    Text("Your Name")
                        .font(DesignTokens.Typography.heading)
                        .fontWeight(.semibold)
                        .foregroundStyle(DesignTokens.Colors.textLight)
                    Spacer()
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.md)
                .padding(.bottom, DesignTokens.Spacing.sm)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("What should we call you?")
                            .font(DesignTokens.Typography.title)
                            .foregroundStyle(DesignTokens.Colors.textLight)

                        Text("Apple didn't share a name this time. Pick a display name for the table — you can change it later in Settings.")
                            .font(DesignTokens.Typography.body)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text("DISPLAY NAME")
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                            .tracking(1.2)

                        TextField("e.g. Alex", text: $nameDraft)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .font(DesignTokens.Typography.heading)
                            .foregroundStyle(DesignTokens.Colors.textLight)
                            .padding(.horizontal, DesignTokens.Spacing.md)
                            .padding(.vertical, 14)
                            .background(
                                RoundedRectangle(cornerRadius: 13, style: .continuous)
                                    .fill(theme.ui.surfaceGlass)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                                            .stroke(
                                                focused ? theme.ui.accent.opacity(0.7) : theme.ui.accent.opacity(0.22),
                                                lineWidth: focused ? 1.5 : 1
                                            )
                                    )
                            )
                            .focused($focused)
                            .submitLabel(.done)
                            .onSubmit { submit() }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.danger)
                    }

                    Spacer(minLength: 12)

                    Button {
                        submit()
                    } label: {
                        HStack {
                            if isSubmitting {
                                ProgressView()
                                    .tint(theme.tablePalette.backgroundColor)
                            }
                            Text(isSubmitting ? "Saving..." : "Continue")
                                .font(DesignTokens.Typography.heading)
                                .fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .foregroundStyle(theme.tablePalette.backgroundColor)
                        .background(
                            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel, style: .continuous)
                                .fill(
                                    LinearGradient(
                                        colors: theme.ui.accentGradient,
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                        )
                        .shadow(color: theme.ui.accent.opacity(0.35), radius: 14, y: 6)
                    }
                    .buttonStyle(.springPressable(scale: 0.97, feedback: .confirm))
                    .disabled(isSubmitting || !canSubmit)
                    .opacity(canSubmit ? 1 : 0.55)
                }
                .frame(maxWidth: DesignTokens.Layout.maxContentWidth)
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xl)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
        .interactiveDismissDisabled(true)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear {
            let current = PlayerNameStore.shared.name
            if !ConvexAuth.isPlaceholderDisplayName(current) {
                nameDraft = current
            }
            focused = true
        }
    }

    private func submit() {
        guard !isSubmitting else { return }
        let trimmed = nameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            errorMessage = ConvexAuth.AuthError.invalidDisplayName.errorDescription
            return
        }

        isSubmitting = true
        errorMessage = nil
        Task {
            do {
                try await ConvexAuth.shared.completeDisplayNamePrompt(trimmed)
                await MainActor.run {
                    isSubmitting = false
                    FeedbackManager.shared.trigger(.confirm)
                    onCompleted?()
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    errorMessage = error.localizedDescription
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }
}
