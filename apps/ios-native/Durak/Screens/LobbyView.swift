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
    @State private var lobbyNotice: LobbyNotice? = nil
    @State private var noticeClearTask: Task<Void, Never>? = nil
    /// Optimistic seat drafts applied until server poll catches up.
    @State private var seatOverrides: [Int: SeatDraft] = [:]

    private enum SeatDraft: Equatable {
        case open
        case bot(difficulty: AiDifficulty)
    }

    private enum LobbyNoticeKind: Equatable {
        case waiting
        case error
    }

    private struct LobbyNotice: Equatable {
        let title: String
        let detail: String
        let kind: LobbyNoticeKind
    }

    private let seatRowHeight: CGFloat = 56

    private var activeRoom: OnlineBridge.RoomView? {
        OnlineBridge.shared.activeRoomView
    }

    private var maxSeats: Int {
        Int(activeRoom?.config?.numPlayers ?? Double(gameVM.numPlayers))
    }

    private var members: [OnlineBridge.RoomMember] {
        activeRoom?.members ?? []
    }

    private var roomDefaultDifficulty: AiDifficulty {
        if let diffStr = activeRoom?.config?.difficulty,
           let diff = AiDifficulty(rawValue: diffStr) {
            return diff
        }
        return gameVM.difficulty
    }

    private var currentRoomCode: String {
        gameVM.onlineRoomCode ?? activeRoom?.code ?? "••••••"
    }

    /// Fingerprint of server seats so optimistic drafts clear when poll catches up.
    private var seatReconcileKey: String {
        members
            .map { "\(Int($0.seatIndex)):\($0.isBot):\($0.difficulty ?? "")" }
            .sorted()
            .joined(separator: "|")
    }

    private var seatedCount: Int {
        var count = 0
        for seat in 0..<maxSeats {
            if resolvedMember(seatIndex: seat) != nil { count += 1 }
            else if case .bot = seatOverrides[seat] { count += 1 }
        }
        // Host placeholder before first poll
        if count == 0 && gameVM.onlineIsHost { return 1 }
        return count
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
                    .frame(maxWidth: DesignTokens.Layout.maxPanelWidth)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.md)

                // 2. Scrollable Cards
                ScrollView(showsIndicators: false) {
                    VStack(spacing: DesignTokens.Spacing.lg) {
                        // Room Code & Invite Card
                        roomCodeCard

                        if let notice = lobbyNotice {
                            lobbyNoticeBanner(notice)
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        // Player Seats Card
                        seatsCard

                        // Match Rules & Info Card
                        matchInfoCard
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxPanelWidth)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.xs)
                    .padding(.bottom, 100) // Padding for bottom floating action bar
                    .frame(maxWidth: .infinity)
                }

                // 3. Bottom Pinned Action Bar
                bottomActionBar
                    .frame(maxWidth: DesignTokens.Layout.maxPanelWidth)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.lg)
                    .frame(maxWidth: .infinity)
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
        .onChange(of: seatReconcileKey) { _, _ in
            reconcileSeatOverrides()
        }
    }

    /// Drop optimistic drafts once the server view matches.
    private func reconcileSeatOverrides() {
        guard !seatOverrides.isEmpty else { return }
        var next = seatOverrides
        for (seat, draft) in seatOverrides {
            let server = members.first { Int($0.seatIndex) == seat }
            switch draft {
            case .open:
                if server == nil { next.removeValue(forKey: seat) }
            case .bot(let difficulty):
                if let server, server.isBot {
                    let serverDiff = difficultyFor(member: server)
                    if serverDiff == difficulty {
                        next.removeValue(forKey: seat)
                    }
                }
            }
        }
        seatOverrides = next
    }

    private func resolvedMember(seatIndex: Int) -> OnlineBridge.RoomMember? {
        if case .open = seatOverrides[seatIndex] { return nil }
        return members.first { Int($0.seatIndex) == seatIndex }
    }

    private func difficultyFor(member: OnlineBridge.RoomMember) -> AiDifficulty {
        if let raw = member.difficulty, let diff = AiDifficulty(rawValue: raw) {
            return diff
        }
        return roomDefaultDifficulty
    }

    private func displayDifficulty(seatIndex: Int, member: OnlineBridge.RoomMember?) -> AiDifficulty {
        if case .bot(let difficulty) = seatOverrides[seatIndex] {
            return difficulty
        }
        if let member {
            return difficultyFor(member: member)
        }
        return roomDefaultDifficulty
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

                let rawVariant = (activeRoom?.config?.variant ?? gameVM.variant.rawValue).lowercased()
                let variantText = rawVariant.contains("perevod")
                    ? String(localized: "Perevodnoy")
                    : String(localized: "Podkidnoy")
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

                // Share Universal Link invite
                ShareLink(
                    item: InviteLinks.joinURL(code: currentRoomCode),
                    subject: Text("Durak invite"),
                    message: Text(InviteLinks.shareMessage(code: currentRoomCode))
                ) {
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
                .disabled(!InviteLinks.isPlausibleRoomCode(currentRoomCode))
                .opacity(InviteLinks.isPlausibleRoomCode(currentRoomCode) ? 1 : 0.45)
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
                Label("TABLE SEATS (\(seatedCount)/\(maxSeats))", systemImage: "person.2.fill")
                    .font(DesignTokens.Typography.label)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(2)

                Spacer()
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
        let override = seatOverrides[seatIndex]
        let member = resolvedMember(seatIndex: seatIndex)

        Group {
            if case .bot(let difficulty) = override, member == nil || member?.isBot != true {
                aiBotSeatRow(seatIndex: seatIndex, member: nil, difficulty: difficulty)
            } else if let member {
                if member.isBot {
                    aiBotSeatRow(
                        seatIndex: seatIndex,
                        member: member,
                        difficulty: displayDifficulty(seatIndex: seatIndex, member: member)
                    )
                } else {
                    humanSeatRow(seatIndex: seatIndex, member: member)
                }
            } else if seatIndex == 0 && gameVM.onlineIsHost {
                hostPlaceholderRow
            } else {
                openSeatRow(seatIndex: seatIndex)
            }
        }
        .frame(minHeight: seatRowHeight)
        .opacity(mutatingSeat == seatIndex ? 0.55 : 1)
        .overlay(alignment: .trailing) {
            if mutatingSeat == seatIndex {
                ProgressView()
                    .scaleEffect(0.7)
                    .tint(theme.ui.accent)
                    .padding(.trailing, 12)
            }
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
        .frame(maxWidth: .infinity, minHeight: seatRowHeight, alignment: .leading)
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

            HStack(spacing: 6) {
                if isHost {
                    Text("HOST")
                        .font(.caption2)
                        .fontWeight(.heavy)
                        .foregroundStyle(theme.ui.badgeText)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(theme.ui.badgeBg))
                }
                if member.isReady == true {
                    Text("READY")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundStyle(DesignTokens.Colors.success)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(DesignTokens.Colors.success.opacity(0.18)))
                } else if !isHost {
                    Text("JOINED")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(DesignTokens.Colors.textMuted)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.white.opacity(0.08)))
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: seatRowHeight, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                .fill(theme.ui.surfaceCard)
        )
    }

    private func aiBotSeatRow(
        seatIndex: Int,
        member: OnlineBridge.RoomMember?,
        difficulty: AiDifficulty
    ) -> some View {
        let name = member?.displayName ?? "AI"
        return HStack(spacing: 12) {
            Text("🤖")
                .font(.system(size: 20))
                .frame(width: 36, height: 36)
                .background(Circle().fill(theme.ui.accentSoft))

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
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
                                    setBotDifficulty(seatIndex: seatIndex, difficulty: .easy)
                                } label: {
                                    Label("Easy AI (Casual)", systemImage: "tortoise.fill")
                                }
                                Button {
                                    setBotDifficulty(seatIndex: seatIndex, difficulty: .medium)
                                } label: {
                                    Label("Medium AI (Balanced)", systemImage: "sparkles")
                                }
                                Button {
                                    setBotDifficulty(seatIndex: seatIndex, difficulty: .hard)
                                } label: {
                                    Label("Hard AI (Master)", systemImage: "flame.fill")
                                }
                            }
                        } label: {
                            HStack(spacing: 2) {
                                Text("• \(difficulty.rawValue.capitalized)")
                                    .font(.system(size: 10, weight: .semibold))
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.system(size: 8, weight: .semibold))
                            }
                            .foregroundStyle(difficultyColor(difficulty))
                        }
                    } else {
                        Text("• \(difficulty.rawValue.capitalized)")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(difficultyColor(difficulty))
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
                .disabled(mutatingSeat == seatIndex)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: seatRowHeight, alignment: .leading)
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
                Text(String(localized: "Seat \(seatIndex + 1) — Open"))
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
                .disabled(mutatingSeat == seatIndex)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: seatRowHeight, alignment: .leading)
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
                    value: gameVM.throwInScope == .all
                        ? String(localized: "All Players")
                        : String(localized: "Neighbors"),
                    icon: "arrow.left.and.right"
                )
                rulePill(
                    title: "TIMER",
                    value: String(localized: "\(Int(activeRoom?.turnTimerSeconds ?? Double(gameVM.turnTimerSeconds)))s"),
                    icon: "stopwatch.fill"
                )
                rulePill(
                    title: "STYLE",
                    value: gameVM.playStyle == .standard
                        ? String(localized: "Classic")
                        : String(localized: "Skills"),
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

    private func rulePill(title: LocalizedStringKey, value: String, icon: String) -> some View {
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
                Button {
                    handleStartMatch()
                } label: {
                    HStack(spacing: 10) {
                        if isStarting {
                            ProgressView()
                                .tint(theme.ui.accentText)
                        } else {
                            Image(systemName: "play.fill")
                                .font(.system(size: 16, weight: .bold))
                        }
                        Text(isStarting ? "STARTING MATCH..." : "START MATCH")
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

    // MARK: - Lobby Notice

    private func lobbyNoticeBanner(_ notice: LobbyNotice) -> some View {
        let accent: Color = notice.kind == .waiting ? theme.ui.accent : DesignTokens.Colors.danger
        let iconName = notice.kind == .waiting ? "person.2.fill" : "exclamationmark.triangle.fill"

        return HStack(alignment: .top, spacing: 12) {
            Image(systemName: iconName)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(accent)
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
                dismissLobbyNotice()
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
                .fill(accent.opacity(notice.kind == .waiting ? 0.14 : 0.16))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(accent.opacity(0.35), lineWidth: 1)
                )
        )
    }

    private func showLobbyNotice(_ notice: LobbyNotice) {
        noticeClearTask?.cancel()
        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            lobbyNotice = notice
        }
        guard notice.kind == .waiting else { return }
        noticeClearTask = Task {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                dismissLobbyNotice()
            }
        }
    }

    private func dismissLobbyNotice() {
        noticeClearTask?.cancel()
        noticeClearTask = nil
        withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
            lobbyNotice = nil
        }
    }

    private func showGenericError(title: String, underlying: Error) {
        showLobbyNotice(
            LobbyNotice(
                title: title,
                detail: strippedServerDetail(underlying.localizedDescription),
                kind: .error
            )
        )
    }

    /// Maps start-match failures to short, user-facing copy (no Request IDs / stack paths).
    private func noticeForStartFailure(_ error: Error) -> LobbyNotice {
        let raw = error.localizedDescription
        let lowered = raw.lowercased()

        if lowered.contains("waiting for all players to be ready") {
            return LobbyNotice(
                title: String(localized: "Players aren’t ready"),
                detail: String(localized: "Ask everyone to tap I’m Ready, then start the match."),
                kind: .waiting
            )
        }
        if lowered.contains("waiting for another player") {
            return LobbyNotice(
                title: String(localized: "Need another player"),
                detail: String(localized: "Invite a friend or add an AI seat to begin."),
                kind: .waiting
            )
        }
        if lowered.contains("only the host can start") {
            return LobbyNotice(
                title: String(localized: "Only the host can start"),
                detail: String(localized: "Wait for the host to begin the match."),
                kind: .error
            )
        }
        if lowered.contains("need at least") {
            return LobbyNotice(
                title: String(localized: "Not enough players"),
                detail: String(localized: "Add at least one AI or wait for a player."),
                kind: .waiting
            )
        }

        return LobbyNotice(
            title: String(localized: "Couldn’t start the match"),
            detail: strippedServerDetail(raw),
            kind: .error
        )
    }

    private func strippedServerDetail(_ message: String) -> String {
        var text = message
        // Drop Convex wrapping / stack frames.
        if let range = text.range(of: "Uncaught Error:", options: .caseInsensitive) {
            text = String(text[range.upperBound...])
        } else if let range = text.range(of: "Convex Error:", options: .caseInsensitive) {
            text = String(text[range.upperBound...])
        }
        if let range = text.range(of: "\nat ") {
            text = String(text[..<range.lowerBound])
        }
        if let range = text.range(of: " at handler") {
            text = String(text[..<range.lowerBound])
        }
        // Drop Request ID brackets.
        while let start = text.range(of: "[Request ID:"),
              let end = text[start.lowerBound...].range(of: "]") {
            text.removeSubrange(start.lowerBound..<end.upperBound)
        }
        text = text
            .replacingOccurrences(of: "Server Error", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty {
            return String(localized: "Please try again in a moment.")
        }
        if text.count > 80 {
            return String(text.prefix(77)) + "…"
        }
        return text
    }

    /// Host Start implies host is ready — only seated guests must have tapped I'm Ready.
    private var humansNotReady: Bool {
        let humans = members.filter { !$0.isBot }
        guard humans.count >= 2 else { return false }
        let guests = gameVM.onlineIsHost
            ? humans.filter { $0.isSelf != true }
            : humans
        return guests.contains { $0.isReady != true }
    }

    // MARK: - Actions

    private func copyRoomCode() {
        UIPasteboard.general.string = currentRoomCode
        withAnimation(.interactiveSpring(response: 0.22, dampingFraction: 0.75)) {
            copiedCode = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                copiedCode = false
            }
        }
    }

    private func handleLeave() {
        if let roomId = gameVM.onlineRoomId {
            Task {
                await OnlineBridge.shared.leaveRoom(roomId: roomId)
            }
        }
        gameVM.goHome()
        router.navigate(to: .home)
    }

    private func addBot(seatIndex: Int, difficulty: AiDifficulty) {
        guard let roomId = gameVM.onlineRoomId else { return }
        mutatingSeat = seatIndex
        seatOverrides[seatIndex] = .bot(difficulty: difficulty)
        FeedbackManager.shared.trigger(.selection)
        Task {
            do {
                try await OnlineBridge.shared.setLobbyBot(
                    roomId: roomId,
                    seatIndex: seatIndex,
                    enabled: true,
                    difficulty: difficulty
                )
            } catch {
                await MainActor.run {
                    seatOverrides[seatIndex] = .open
                    showGenericError(title: String(localized: "Couldn’t add AI"), underlying: error)
                }
            }
            await MainActor.run {
                mutatingSeat = nil
                reconcileSeatOverrides()
            }
        }
    }

    private func removeBot(seatIndex: Int) {
        guard let roomId = gameVM.onlineRoomId else { return }
        mutatingSeat = seatIndex
        seatOverrides[seatIndex] = .open
        Task {
            do {
                try await OnlineBridge.shared.setLobbyBot(
                    roomId: roomId,
                    seatIndex: seatIndex,
                    enabled: false
                )
            } catch {
                await MainActor.run {
                    seatOverrides.removeValue(forKey: seatIndex)
                    showGenericError(title: String(localized: "Couldn’t remove AI"), underlying: error)
                }
            }
            await MainActor.run {
                mutatingSeat = nil
                reconcileSeatOverrides()
            }
        }
    }

    private func setBotDifficulty(seatIndex: Int, difficulty: AiDifficulty) {
        guard let roomId = gameVM.onlineRoomId else { return }
        mutatingSeat = seatIndex
        seatOverrides[seatIndex] = .bot(difficulty: difficulty)
        FeedbackManager.shared.trigger(.selection)
        Task {
            do {
                try await OnlineBridge.shared.setLobbyBotDifficulty(
                    roomId: roomId,
                    seatIndex: seatIndex,
                    difficulty: difficulty
                )
            } catch {
                await MainActor.run {
                    seatOverrides.removeValue(forKey: seatIndex)
                    showGenericError(title: String(localized: "Couldn’t update difficulty"), underlying: error)
                }
            }
            await MainActor.run {
                mutatingSeat = nil
                reconcileSeatOverrides()
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
        Task {
            try? await OnlineBridge.shared.setReady(roomId: roomId, ready: !isReady)
        }
    }

    private func handleStartMatch() {
        guard let roomId = gameVM.onlineRoomId else { return }

        if seatedCount < 2 {
            showLobbyNotice(
                LobbyNotice(
                    title: String(localized: "Need another player"),
                    detail: String(localized: "Add at least one AI or wait for a player to join."),
                    kind: .waiting
                )
            )
            FeedbackManager.shared.trigger(.selection)
            return
        }

        if humansNotReady {
            showLobbyNotice(
                LobbyNotice(
                    title: String(localized: "Players aren’t ready"),
                    detail: String(localized: "Ask everyone to tap I’m Ready, then start the match."),
                    kind: .waiting
                )
            )
            FeedbackManager.shared.trigger(.selection)
            return
        }

        isStarting = true
        dismissLobbyNotice()

        Task {
            do {
                // Mark host ready so the seat badge updates if start is slow.
                if gameVM.onlineIsHost, activeRoom?.yourIsReady != true {
                    try? await OnlineBridge.shared.setReady(roomId: roomId, ready: true)
                }
                // Never autofill empty seats — keep only explicitly seated players/AI.
                try await OnlineBridge.shared.startGame(roomId: roomId, soloWithAi: false)
                let view: OnlineBridge.RoomView = try await ConvexHTTPClient.shared.query(
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
                    let notice = noticeForStartFailure(error)
                    showLobbyNotice(notice)
                    FeedbackManager.shared.trigger(notice.kind == .waiting ? .selection : .failure)
                }
            }
        }
    }
}
