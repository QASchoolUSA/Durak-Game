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
    @State private var joinNotice: OnlineErrorCopy.Notice? = nil
    @State private var clipboardCode: String? = nil

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
                    VStack(spacing: DesignTokens.Spacing.xl) {
                        VStack(spacing: DesignTokens.Spacing.xs) {
                            Text("ENTER ROOM CODE")
                                .font(DesignTokens.Typography.caption)
                                .fontWeight(.bold)
                                .foregroundStyle(theme.ui.accent)
                                .tracking(2)

                            Text("Ask your friend for the room code, tap their invite link, or paste from the clipboard.")
                                .font(DesignTokens.Typography.body)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, DesignTokens.Spacing.xs)

                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                            TextField("e.g. 482193", text: $roomCode)
                                .font(.system(size: 28, weight: .bold, design: .monospaced))
                                .foregroundStyle(theme.ui.accent)
                                .multilineTextAlignment(.center)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .keyboardType(.asciiCapable)
                                .padding()
                                .background(
                                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                        .fill(theme.ui.surfaceGlass)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                                .stroke(theme.ui.accent.opacity(0.4), lineWidth: 1.5)
                                        )
                                )
                                .onChange(of: roomCode) { _, _ in
                                    if joinNotice != nil { dismissNotice() }
                                }

                            if let clipboardCode, roomCode.isEmpty || roomCode != clipboardCode {
                                Button {
                                    roomCode = clipboardCode
                                    FeedbackManager.shared.trigger(.selection)
                                } label: {
                                    HStack(spacing: 8) {
                                        Image(systemName: "doc.on.clipboard.fill")
                                            .font(.system(size: 13, weight: .semibold))
                                        Text("Paste code \(clipboardCode)")
                                            .font(DesignTokens.Typography.caption)
                                            .fontWeight(.bold)
                                    }
                                    .foregroundStyle(theme.ui.accent)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .background(
                                        Capsule()
                                            .fill(theme.ui.surfaceCard)
                                            .overlay(Capsule().stroke(theme.ui.accent.opacity(0.35), lineWidth: 1))
                                    )
                                }
                                .buttonStyle(.springPressable(feedback: .selection))
                            }
                        }

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

                        if let notice = joinNotice {
                            onlineNoticeBanner(notice)
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }

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
                        .buttonStyle(.springPressable(feedback: .confirm))
                        .disabled(!isFormValid || isLoading)
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxContentWidth)
                    .padding(DesignTokens.Spacing.xl)
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .onAppear {
            applyPendingJoinCode()
            refreshClipboardSuggestion()
        }
        .onChange(of: router.pendingJoinCode) { _, _ in
            applyPendingJoinCode()
        }
    }

    private var sheetHeader: some View {
        HStack {
            Button("Cancel") {
                router.pendingJoinCode = nil
                dismiss()
            }
            .font(DesignTokens.Typography.body)
            .fontWeight(.semibold)
            .foregroundStyle(theme.ui.accent)
            .buttonStyle(.springPressable(scale: 0.94, feedback: .uiTap))

            Spacer()

            Text("Join Game")
                .font(DesignTokens.Typography.heading)
                .foregroundStyle(DesignTokens.Colors.textLight)

            Spacer()

            Text("Cancel")
                .font(DesignTokens.Typography.body)
                .fontWeight(.semibold)
                .opacity(0)
                .allowsHitTesting(false)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.md)
        .padding(.bottom, DesignTokens.Spacing.sm)
    }

    private func onlineNoticeBanner(_ notice: OnlineErrorCopy.Notice) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(theme.ui.accent)
                .frame(width: 22, height: 22)
                .padding(.top, 1)

            VStack(alignment: .leading, spacing: 3) {
                Text(notice.title)
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(DesignTokens.Colors.textLight)
                Text(notice.detail)
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 8)

            Button {
                dismissNotice()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .frame(width: 24, height: 24)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.accent.opacity(0.14))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.accent.opacity(0.35), lineWidth: 1)
                )
        )
    }

    private var isFormValid: Bool {
        let cleanCode = roomCode.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanName = playerName.trimmingCharacters(in: .whitespacesAndNewlines)
        return InviteLinks.isPlausibleRoomCode(cleanCode) && !cleanName.isEmpty
    }

    private func dismissNotice() {
        withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
            joinNotice = nil
        }
    }

    private func applyPendingJoinCode() {
        guard let pending = router.pendingJoinCode else { return }
        roomCode = InviteLinks.normalizeRoomCode(pending)
        router.pendingJoinCode = nil
    }

    private func refreshClipboardSuggestion() {
        guard let code = InviteLinks.roomCodeFromPasteboard() else {
            clipboardCode = nil
            return
        }
        clipboardCode = code
        // Soft autofill when the field is still empty (deep link already wins via pending code).
        if roomCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            roomCode = code
        }
    }

    private func handleJoin() {
        let cleanCode = InviteLinks.normalizeRoomCode(roomCode)
        let cleanName = playerName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isFormValid else { return }

        PlayerNameStore.shared.name = cleanName
        gameVM.onlineDisplayName = cleanName

        isLoading = true
        dismissNotice()

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
                    router.pendingJoinCode = nil
                    dismiss()
                    router.navigate(to: .lobby)
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
                        joinNotice = OnlineErrorCopy.joinNotice(for: error)
                    }
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }
}
