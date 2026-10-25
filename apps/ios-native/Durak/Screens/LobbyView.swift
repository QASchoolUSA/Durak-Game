import SwiftUI
import DurakGameCore

/// Apple-grade Online Lobby Screen — waiting for players with ShareLink, Copy Code, Seat management, and Host Start.
struct LobbyView: View {
    @Environment(AppRouter.self) private var router
    @Environment(ThemeManager.self) private var theme
    @Environment(GameViewModel.self) private var gameVM

    @State private var copiedCode = false
    @State private var isStarting = false
    @State private var mutatingSeat: Int? = nil
    @State private var errorMessage: String? = nil

    private var activeRoom: OnlineBridge.RoomView? {
        OnlineBridge.shared.activeRoomView
    }

    private var maxSeats: Int {
        Int(activeRoom?.config?.numPlayers ?? Double(gameVM.numPlayers))
    }

    private var members: [OnlineBridge.RoomMember] {
        activeRoom?.members ?? []
    }

    private var currentDifficulty: AiDifficulty {
        if let diffStr = activeRoom?.config?.difficulty,
           let diff = AiDifficulty(rawValue: diffStr) {
            return diff
        }
        return gameVM.difficulty
    }

    private var currentRoomCode: String {
        gameVM.onlineRoomCode ?? activeRoom?.code ?? "••••••"
    }

    var body: some View {
        ZStack {
            // Background table gradient matching active theme
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // 1. Top Bar pinned cleanly below safe area
                topBar
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.md)

                // 2. Scrollable Cards
                ScrollView(showsIndicators: false) {
                    VStack(spacing: DesignTokens.Spacing.lg) {
                        // Room Code & Invite Card
                        roomCodeCard

                        // Error message banner if any
                        if let error = errorMessage {
                            errorBanner(error)
                        }

                        // Player Seats Card
                        seatsCard

                        // Match Rules & Info Card
                        matchInfoCard
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.xs)
                    .padding(.bottom, 100) // Padding for bottom floating action bar
                }

                // 3. Bottom Pinned Action Bar
                bottomActionBar
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.lg)
                    .background(
                        LinearGradient(
                            colors: [
                                Color.clear,
                                (theme.tablePalette.gradient?.last ?? theme.tablePalette.backgroundColor).opacity(0.85),
                                (theme.tablePalette.gradient?.last ?? theme.tablePalette.backgroundColor)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .ignoresSafeArea(edges: .bottom)
                    )
            }
        }
        .onChange(of: activeRoom?.status) { _, newStatus in
            if newStatus == "playing", let view = activeRoom {
                gameVM.syncOnlineView(view)
                if router.current != .game {
                    router.navigate(to: .game)
                }
            }
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack(alignment: .center) {
            Button {
                handleLeave()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .bold))
                    Text("Leave")
                        .font(DesignTokens.Typography.body)
                        .fontWeight(.semibold)
                }
                .foregroundStyle(theme.ui.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(theme.ui.surfaceCard)
                        .overlay(Capsule().stroke(theme.ui.surfaceBorder, lineWidth: 1))
                )
            }
            .buttonStyle(.springPressable(feedback: .uiTap))

            Spacer()

            VStack(spacing: 3) {
                Text("ONLINE LOBBY")
                    .font(DesignTokens.Typography.heading)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textLight)
                    .tracking(2.5)

                let variantText = (activeRoom?.config?.variant ?? gameVM.variant.rawValue).capitalized
                HStack(spacing: 6) {
                    Circle()
                        .fill(DesignTokens.Colors.success)
                        .frame(width: 6, height: 6)
                    Text("\(variantText) • \(maxSeats) Players")
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(theme.ui.accentMuted)
                }
            }

            Spacer()

            // Balance width for centered title
            Color.clear.frame(width: 78, height: 36)
        }
    }

    // MARK: - Room Code Card

    private var roomCodeCard: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            HStack {
                Label("MATCH CODE", systemImage: "number.circle.fill")
                    .font(DesignTokens.Typography.label)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(2)

                Spacer()

                Text("Share with friends")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(theme.ui.accentMuted)
            }

            // Big glowing code display
            Text(currentRoomCode)
                .font(.system(size: 46, weight: .black, design: .monospaced))
                .foregroundStyle(
                    LinearGradient(
                        colors: theme.ui.accentGradient,
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .tracking(6)
                .shadow(color: theme.ui.accent.opacity(0.35), radius: 12)
                .padding(.vertical, 4)

            // Copy & Invite Action Buttons
            HStack(spacing: 12) {
                // Copy button
                Button {
                    copyRoomCode()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: copiedCode ? "checkmark" : "doc.on.doc.fill")
                            .font(.system(size: 13, weight: .semibold))
                        Text(copiedCode ? "Copied!" : "Copy Code")
                            .font(DesignTokens.Typography.caption)
                            .fontWeight(.bold)
                    }
                    .foregroundStyle(copiedCode ? DesignTokens.Colors.success : DesignTokens.Colors.textLight)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        Capsule()
                            .fill(theme.ui.surfaceCard)
                            .overlay(Capsule().stroke(theme.ui.surfaceBorder, lineWidth: 1))
                    )
                }
                .buttonStyle(.springPressable(feedback: .selection))

                // Share invite link
                ShareLink(item: "Join my Durak card game! Room code: \(currentRoomCode)") {
                    HStack(spacing: 8) {
                        Image(systemName: "square.and.arrow.up.fill")
                            .font(.system(size: 13, weight: .semibold))
                        Text("Invite")
                            .font(DesignTokens.Typography.caption)
                            .fontWeight(.bold)
                    }
                    .foregroundStyle(theme.ui.accentText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(
                        LinearGradient(
                            colors: theme.ui.accentGradient,
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: Capsule()
                    )
                    .shadow(color: theme.ui.accent.opacity(0.35), radius: 8, y: 2)
                }
                .buttonStyle(.springPressable(feedback: .selection))
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.surfaceBorderHighlighted, lineWidth: 1)
                )
        )
    }

    // MARK: - Seats Card

    private var seatsCard: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            HStack {
                let seatedCount = max(1, members.count)
                Label("TABLE SEATS (\(seatedCount)/\(maxSeats))", systemImage: "person.2.fill")
                    .font(DesignTokens.Typography.label)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(2)

                Spacer()

                if mutatingSeat != nil {
                    ProgressView()
                        .scaleEffect(0.7)
                        .tint(theme.ui.accent)
                }
            }

            VStack(spacing: 8) {
                ForEach(0..<maxSeats, id: \.self) { seatIndex in
                    seatRow(seatIndex: seatIndex)
                }
            }
        }
        .padding(DesignTokens.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                )
        )
    }

    @ViewBuilder
    private func seatRow(seatIndex: Int) -> some View {
        let member = members.first { Int($0.seatIndex) == seatIndex }

        if let member {
            if member.isBot {
                // AI Bot seated
                aiBotSeatRow(seatIndex: seatIndex, member: member)
            } else {
                // Human player seated
                humanSeatRow(seatIndex: seatIndex, member: member)
            }
        } else if seatIndex == 0 && gameVM.onlineIsHost {
            // Host placeholder before initial poll returns
            hostPlaceholderRow
        } else {
            // Open seat
            openSeatRow(seatIndex: seatIndex)
        }
    }

    private var hostPlaceholderRow: some View {
        HStack(spacing: 12) {
            Text("👑")
                .font(.system(size: 20))
                .frame(width: 36, height: 36)
                .background(Circle().fill(theme.ui.accentSoft))

            VStack(alignment: .leading, spacing: 2) {
                let hostName = PlayerNameStore.shared.name.isEmpty ? "Host" : PlayerNameStore.shared.name
                Text("\(hostName) (You)")
                    .font(DesignTokens.Typography.body)
                    .fontWeight(.bold)
                    .foregroundStyle(theme.ui.accent)

                Text("Table Creator")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(theme.ui.accentMuted)
            }

            Spacer()

            Text("HOST")
                .font(.caption2)
                .fontWeight(.heavy)
                .foregroundStyle(theme.ui.badgeText)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Capsule().fill(theme.ui.badgeBg))
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                .fill(theme.ui.surfaceCard)
        )
    }

    private func humanSeatRow(seatIndex: Int, member: OnlineBridge.RoomMember) -> some View {
        let isHost = seatIndex == 0
        let isMe = member.isSelf ?? (seatIndex == 0 && gameVM.onlineIsHost)

        return HStack(spacing: 12) {
            Circle()
                .fill(DesignTokens.Colors.success)
                .frame(width: 10, height: 10)
                .shadow(color: DesignTokens.Colors.success.opacity(0.6), radius: 4)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(member.displayName)
                        .font(DesignTokens.Typography.body)
                        .fontWeight(isMe ? .bold : .medium)
                        .foregroundStyle(isMe ? theme.ui.accent : DesignTokens.Colors.textLight)

                    if isMe {
                        Text("(You)")
                            .font(.caption2)
                            .foregroundStyle(theme.ui.accentMuted)
                    }
                }
            }

            Spacer()

            if isHost {
                Text("HOST")
                    .font(.caption2)
                    .fontWeight(.heavy)
                    .foregroundStyle(theme.ui.badgeText)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(theme.ui.badgeBg))
            } else if member.isReady == true {
                Text("READY")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.success)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(DesignTokens.Colors.success.opacity(0.18)))
            } else {
                Text("JOINED")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color.white.opacity(0.08)))
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                .fill(theme.ui.surfaceCard)
        )
    }

    private func aiBotSeatRow(seatIndex: Int, member: OnlineBridge.RoomMember) -> some View {
        HStack(spacing: 12) {
            Text("🤖")
                .font(.system(size: 20))
                .frame(width: 36, height: 36)
                .background(Circle().fill(theme.ui.accentSoft))

            VStack(alignment: .leading, spacing: 2) {
                Text(member.displayName)
                    .font(DesignTokens.Typography.body)
                    .fontWeight(.medium)
                    .foregroundStyle(DesignTokens.Colors.textLight)

                HStack(spacing: 4) {
                    Text("AI BOT")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.ui.accentMuted)

                    if gameVM.onlineIsHost {
                        Menu {
                            Section("Change Difficulty") {
                                Button {
                                    selectDifficulty(.easy)
                                } label: {
                                    Label("Easy AI (Casual)", systemImage: "tortoise.fill")
                                }
                                Button {
                                    selectDifficulty(.medium)
                                } label: {
                                    Label("Medium AI (Balanced)", systemImage: "sparkles")
                                }
                                Button {
                                    selectDifficulty(.hard)
                                } label: {
                                    Label("Hard AI (Master)", systemImage: "flame.fill")
                                }
                            }
                        } label: {
                            HStack(spacing: 2) {
                                Text("• \(currentDifficulty.rawValue.capitalized)")
                                    .font(.system(size: 10, weight: .semibold))
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.system(size: 8, weight: .semibold))
                            }
                            .foregroundStyle(difficultyColor(currentDifficulty))
                        }
                    } else {
                        Text("• \(currentDifficulty.rawValue.capitalized)")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(difficultyColor(currentDifficulty))
                    }
                }
            }

            Spacer()

            if gameVM.onlineIsHost {
                Button {
                    removeBot(seatIndex: seatIndex)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .bold))
                        Text("Remove")
                            .font(DesignTokens.Typography.caption)
                            .fontWeight(.semibold)
                    }
                    .foregroundStyle(DesignTokens.Colors.danger)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Capsule().fill(DesignTokens.Colors.danger.opacity(0.12)))
                }
                .buttonStyle(.springPressable(feedback: .uiTap))
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                .fill(theme.ui.surfaceCard)
        )
    }

    private func openSeatRow(seatIndex: Int) -> some View {
        HStack {
            HStack(spacing: 8) {
                Image(systemName: "person.badge.plus")
                    .font(.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                Text("Seat \(seatIndex + 1) — Open")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
            }

            Spacer()

            if gameVM.onlineIsHost {
                Menu {
                    Section("Add AI Player") {
                        Button {
                            addBot(seatIndex: seatIndex, difficulty: .easy)
                        } label: {
                            Label("Easy AI (Casual)", systemImage: "tortoise.fill")
                        }

                        Button {
                            addBot(seatIndex: seatIndex, difficulty: .medium)
                        } label: {
                            Label("Medium AI (Balanced)", systemImage: "sparkles")
                        }

                        Button {
                            addBot(seatIndex: seatIndex, difficulty: .hard)
                        } label: {
                            Label("Hard AI (Master)", systemImage: "flame.fill")
                        }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "plus")
                            .font(.system(size: 11, weight: .bold))
                        Text("Add AI")
                            .font(DesignTokens.Typography.caption)
                            .fontWeight(.bold)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 8, weight: .bold))
                    }
                    .foregroundStyle(theme.ui.accent)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .stroke(theme.ui.accent.opacity(0.6), lineWidth: 1)
                            .background(Capsule().fill(theme.ui.accentSoft))
                    )
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                .stroke(Color.white.opacity(0.08), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
        )
    }

    // MARK: - Match Rules & Info Card

    private var matchInfoCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("MATCH RULES", systemImage: "slider.horizontal.3")
                .font(DesignTokens.Typography.label)
                .fontWeight(.bold)
                .foregroundStyle(DesignTokens.Colors.textMuted)
                .tracking(2)

            HStack(spacing: 8) {
                rulePill(
                    title: "THROW-IN",
                    value: gameVM.throwInScope == .all ? "All Players" : "Neighbors",
                    icon: "arrow.left.and.right"
                )
                rulePill(
                    title: "TIMER",
                    value: "\(Int(activeRoom?.turnTimerSeconds ?? Double(gameVM.turnTimerSeconds)))s",
                    icon: "stopwatch.fill"
                )
                rulePill(
                    title: "STYLE",
                    value: gameVM.playStyle == .standard ? "Classic" : "Skills",
                    icon: "sparkles"
                )
            }
        }
        .padding(DesignTokens.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                )
        )
    }

    private func rulePill(title: String, value: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 9))
                Text(title)
                    .font(.system(size: 9, weight: .bold))
            }
            .foregroundStyle(theme.ui.accentMuted)

            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(DesignTokens.Colors.textLight)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                .fill(theme.ui.surfaceCard)
        )
    }

    // MARK: - Bottom Action Bar

    private var bottomActionBar: some View {
        VStack(spacing: 8) {
            if gameVM.onlineIsHost {
                let seatedCount = max(1, members.count)
                Button {
                    handleStartMatch(seatedCount: seatedCount)
                } label: {
                    HStack(spacing: 10) {
                        if isStarting {
                            ProgressView()
                                .tint(theme.ui.accentText)
                        } else {
                            Image(systemName: "play.fill")
                                .font(.system(size: 16, weight: .bold))
                        }
                        Text(isStarting ? "STARTING MATCH..." : (seatedCount >= 2 ? "START MATCH" : "PLAY WITH AI"))
                            .font(DesignTokens.Typography.heading)
                            .fontWeight(.bold)
                            .tracking(2)
                    }
                    .foregroundStyle(theme.ui.accentText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: theme.ui.accentGradient,
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                    )
                    .goldenShimmer()
                    .shadow(color: theme.ui.accent.opacity(0.45), radius: 12, y: 3)
                }
                .buttonStyle(.springPressable(feedback: .gameStart))
                .disabled(isStarting)
            } else {
                let isReady = activeRoom?.yourIsReady ?? false
                Button {
                    toggleReady(isReady: isReady)
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: isReady ? "checkmark.circle.fill" : "circle")
                        Text(isReady ? "READY ✓" : "I'M READY")
                            .font(DesignTokens.Typography.heading)
                            .tracking(2)
                    }
                    .foregroundStyle(isReady ? DesignTokens.Colors.textLight : theme.ui.accentText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        isReady
                            ? AnyShapeStyle(Color.white.opacity(0.15))
                            : AnyShapeStyle(LinearGradient(colors: theme.ui.accentGradient, startPoint: .leading, endPoint: .trailing)),
                        in: RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                    )
                }
                .buttonStyle(.springPressable(feedback: .confirm))

                Text("Waiting for host to start the match...")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
            }
        }
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(DesignTokens.Colors.danger)
            Text(message)
                .font(DesignTokens.Typography.caption)
                .foregroundStyle(DesignTokens.Colors.danger)
            Spacer()
            Button {
                errorMessage = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2)
                    .foregroundStyle(DesignTokens.Colors.danger)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                .fill(DesignTokens.Colors.danger.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                        .stroke(DesignTokens.Colors.danger.opacity(0.3), lineWidth: 1)
                )
        )
    }

    // MARK: - Actions

    private func copyRoomCode() {
        UIPasteboard.general.string = currentRoomCode
        FeedbackManager.shared.trigger(.selection)
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            copiedCode = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                copiedCode = false
            }
        }
    }

    private func handleLeave() {
        FeedbackManager.shared.trigger(.uiTap)
        if let roomId = gameVM.onlineRoomId {
            Task {
                await OnlineBridge.shared.leaveRoom(roomId: roomId)
            }
        }
        gameVM.goHome()
        router.navigate(to: .home)
    }

    private func addBot(seatIndex: Int, difficulty: AiDifficulty? = nil) {
        guard let roomId = gameVM.onlineRoomId else { return }
        mutatingSeat = seatIndex
        FeedbackManager.shared.trigger(.selection)
        Task {
            do {
                if let diff = difficulty {
                    try await OnlineBridge.shared.setRoomDifficulty(roomId: roomId, difficulty: diff)
                    await MainActor.run {
                        gameVM.difficulty = diff
                    }
                }
                try await OnlineBridge.shared.setLobbyBot(roomId: roomId, seatIndex: seatIndex, enabled: true)
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to add AI: \(error.localizedDescription)"
                }
            }
            await MainActor.run {
                mutatingSeat = nil
            }
        }
    }

    private func removeBot(seatIndex: Int) {
        guard let roomId = gameVM.onlineRoomId else { return }
        mutatingSeat = seatIndex
        FeedbackManager.shared.trigger(.selection)
        Task {
            do {
                try await OnlineBridge.shared.setLobbyBot(roomId: roomId, seatIndex: seatIndex, enabled: false)
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to remove AI: \(error.localizedDescription)"
                }
            }
            await MainActor.run {
                mutatingSeat = nil
            }
        }
    }

    private func selectDifficulty(_ level: AiDifficulty) {
        guard let roomId = gameVM.onlineRoomId else { return }
        FeedbackManager.shared.trigger(.selection)
        Task {
            do {
                try await OnlineBridge.shared.setRoomDifficulty(roomId: roomId, difficulty: level)
                await MainActor.run {
                    gameVM.difficulty = level
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to update difficulty: \(error.localizedDescription)"
                }
            }
        }
    }

    private func difficultyColor(_ diff: AiDifficulty) -> Color {
        switch diff {
        case .easy: return .green
        case .medium: return theme.ui.accent
        case .hard: return DesignTokens.Colors.danger
        }
    }

    private func toggleReady(isReady: Bool) {
        guard let roomId = gameVM.onlineRoomId else { return }
        FeedbackManager.shared.trigger(.selection)
        Task {
            try? await OnlineBridge.shared.setReady(roomId: roomId, ready: !isReady)
        }
    }

    private func handleStartMatch(seatedCount: Int) {
        guard let roomId = gameVM.onlineRoomId else { return }
        isStarting = true
        errorMessage = nil
        FeedbackManager.shared.trigger(.gameStart)

        Task {
            do {
                try await OnlineBridge.shared.startGame(roomId: roomId, soloWithAi: seatedCount < 2)
                // Immediately query the freshly updated room view
                let view: OnlineBridge.RoomView = try await ConvexClient.shared.query(
                    "rooms:getRoomView",
                    args: ["roomId": roomId]
                )
                await MainActor.run {
                    OnlineBridge.shared.activeRoomView = view
                    gameVM.syncOnlineView(view)
                    isStarting = false
                    router.navigate(to: .game)
                }
            } catch {
                await MainActor.run {
                    isStarting = false
                    errorMessage = "Failed to start match: \(error.localizedDescription)"
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }
}
