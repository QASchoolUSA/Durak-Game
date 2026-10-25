import SwiftUI

/// Sheet allowing a player to enter a Room Code and display name to join an online match.
struct JoinGameSheet: View {
    @Environment(AppRouter.self) private var router
    @Environment(GameViewModel.self) private var gameVM
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    @State private var roomCode: String = ""
    @State private var playerName: String = PlayerNameStore.shared.name
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                // Background matching active table theme
                LinearGradient(
                    colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: DesignTokens.Spacing.xl) {
                    // Header prompt
                    VStack(spacing: DesignTokens.Spacing.xs) {
                        Text("ENTER ROOM CODE")
                            .font(DesignTokens.Typography.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(theme.ui.accent)
                            .tracking(2)

                        Text("Ask your friend for the room code or check your match invite.")
                            .font(DesignTokens.Typography.body)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, DesignTokens.Spacing.md)

                    // Room Code Field
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        TextField("e.g. AB12CD", text: $roomCode)
                            .font(.system(size: 28, weight: .bold, design: .monospaced))
                            .foregroundStyle(theme.ui.accent)
                            .multilineTextAlignment(.center)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .padding()
                            .background(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                    .fill(theme.ui.surfaceGlass)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                            .stroke(theme.ui.accent.opacity(0.4), lineWidth: 1.5)
                                    )
                            )
                    }

                    // Display Name Field
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text("YOUR DISPLAY NAME")
                            .font(DesignTokens.Typography.label)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                            .tracking(2)

                        TextField("Player Name", text: $playerName)
                            .font(DesignTokens.Typography.heading)
                            .foregroundStyle(DesignTokens.Colors.textLight)
                            .padding()
                            .background(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                    .fill(theme.ui.surfaceGlass)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                                    )
                            )
                    }

                    // Error message if any
                    if let err = errorMessage {
                        Text(err)
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.danger)
                            .multilineTextAlignment(.center)
                            .transition(.opacity)
                    }

                    // Join Button
                    Button {
                        handleJoin()
                    } label: {
                        HStack(spacing: 8) {
                            if isLoading {
                                ProgressView()
                                    .tint(theme.ui.accentText)
                            }
                            Text(isLoading ? "JOINING..." : "JOIN GAME")
                                .font(DesignTokens.Typography.heading)
                                .tracking(1)
                        }
                        .foregroundStyle(theme.ui.accentText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignTokens.Spacing.md)
                        .background(
                            LinearGradient(
                                colors: isFormValid
                                    ? theme.ui.accentGradient
                                    : [theme.ui.accent.opacity(0.35), theme.ui.accent.opacity(0.18)],
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            in: RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        )
                        .shadow(color: isFormValid ? theme.ui.accent.opacity(0.4) : Color.clear, radius: 10, y: 3)
                    }
                    .disabled(!isFormValid || isLoading)
                }
                .padding(DesignTokens.Spacing.xl)
            }
        }
        .navigationTitle("Join Game")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundStyle(theme.ui.accent)
                }
            }
        }
    }

    private var isFormValid: Bool {
        let cleanCode = roomCode.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanName = playerName.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleanCode.count >= 4 && !cleanName.isEmpty
    }

    private func handleJoin() {
        let cleanCode = roomCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let cleanName = playerName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isFormValid else { return }

        // Save name
        PlayerNameStore.shared.name = cleanName
        gameVM.onlineDisplayName = cleanName

        isLoading = true
        errorMessage = nil
        FeedbackManager.shared.trigger(.selection)

        Task {
            do {
                let res = try await OnlineBridge.shared.joinRoom(code: cleanCode, displayName: cleanName)
                await MainActor.run {
                    isLoading = false
                    gameVM.onlineRoomId = res.roomId
                    gameVM.onlineRoomCode = cleanCode
                    gameVM.onlineDisplayName = cleanName
                    gameVM.onlineIsHost = false
                    gameVM.playMode = .online
                    dismiss()
                    router.navigate(to: .lobby)
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "Failed to join room: \(error.localizedDescription)"
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }
}
