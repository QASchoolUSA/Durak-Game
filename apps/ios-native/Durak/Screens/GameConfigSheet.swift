import SwiftUI
import DurakGameCore

/// Game configuration sheet — player count, variant, difficulty, and instant Solo or Online start.
/// Styled with Apple Human Interface Guidelines and dynamic theme palette.
struct GameConfigSheet: View {
    @Environment(AppRouter.self) private var router
    @Environment(GameViewModel.self) private var gameVM
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    @State private var isCreatingRoom = false
    @State private var createNotice: OnlineErrorCopy.Notice?

    var body: some View {
        ZStack {
            // Background matching active table theme
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // Lightweight sheet header (avoids UINavigationController presentation lag)
                sheetHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: DesignTokens.Spacing.lg) {
                        // 1. Player Count Swipe Wheel
                        compactPlayerWheelSection

                        // 2. Game Variant Cards
                        variantSection

                        // 3. Match Rules & Scope
                        rulesSection

                        // 4. Turn timer (helpful for flaky / cross-state WiFi)
                        turnTimerSection

                        if let notice = createNotice {
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
                                    withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
                                        createNotice = nil
                                    }
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
                            .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        // 4. Start Button & Summary
                        actionButtonSection
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxContentWidth)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.xl)
                    .frame(maxWidth: .infinity)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private var sheetHeader: some View {
        HStack {
            Button("Cancel") {
                dismiss()
            }
            .font(DesignTokens.Typography.body)
            .fontWeight(.semibold)
            .foregroundStyle(theme.ui.accent)
            .buttonStyle(.springPressable(scale: 0.94, feedback: .uiTap))

            Spacer()

            Text("New Match")
                .font(DesignTokens.Typography.heading)
                .foregroundStyle(DesignTokens.Colors.textLight)

            Spacer()

            // Balance trailing spacing
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

    // MARK: - Compact Swipe Wheel Player Count

    private var compactPlayerWheelSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            HStack {
                Label("PLAYERS", systemImage: "person.2.fill")
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(2)

                Spacer()

                Text(playerCountSubtitle(gameVM.numPlayers))
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(theme.ui.accent)
            }

            // Compact horizontal swipeable wheel with numbers only
            CompactWheelPlayerPicker(
                selectedCount: Binding(
                    get: { gameVM.numPlayers },
                    set: { newCount in
                        if gameVM.numPlayers != newCount {
                            FeedbackManager.shared.trigger(.selection)
                            withAnimation(.interactiveSpring(response: 0.22, dampingFraction: 0.76)) {
                                gameVM.numPlayers = newCount
                            }
                        }
                    }
                )
            )
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

    private func playerCountSubtitle(_ count: Int) -> String {
        switch count {
        case 2: return "Duel (1 vs 1)"
        case 3: return "Trio Table"
        case 4: return "Classic 4-Player"
        case 5: return "5-Player Round"
        case 6: return "Full House (6 Max)"
        default: return "\(count) Players"
        }
    }

    // MARK: - Variant Cards Section

    private var variantSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Label("GAME VARIANT", systemImage: "suit.spade.fill")
                .font(DesignTokens.Typography.caption)
                .fontWeight(.bold)
                .foregroundStyle(DesignTokens.Colors.textMuted)
                .tracking(2)

            VStack(spacing: 10) {
                VariantCardRow(
                    title: "Podkidnoy",
                    subtitle: "Classic Throw-In",
                    desc: "Attackers throw in matching card ranks to overwhelm the defender.",
                    icon: "arrow.down.forward.and.arrow.up.backward",
                    isSelected: gameVM.variant == .podkidnoy
                ) {
                    withAnimation(.interactiveSpring(response: 0.22, dampingFraction: 0.78)) {
                        gameVM.variant = .podkidnoy
                    }
                }

                VariantCardRow(
                    title: "Perevodnoy",
                    subtitle: "Passing & Transfer",
                    desc: "Defender can transfer attack to the next player with matching rank.",
                    icon: "arrow.triangle.2.circlepath",
                    isSelected: gameVM.variant == .perevodnoy
                ) {
                    withAnimation(.interactiveSpring(response: 0.22, dampingFraction: 0.78)) {
                        gameVM.variant = .perevodnoy
                    }
                }
            }
        }
    }

    // MARK: - Rules & Scope Section

    private var rulesSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            // Throw-In Scope
            VStack(alignment: .leading, spacing: 6) {
                Label("THROW-IN ELIGIBILITY", systemImage: "hand.tap.fill")
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(2)

                HStack(spacing: 10) {
                    OptionPillRow(
                        title: "All Players",
                        icon: "person.3.fill",
                        isSelected: gameVM.throwInScope == .all
                    ) {
                        withAnimation(.interactiveSpring(response: 0.2, dampingFraction: 0.8)) {
                            gameVM.throwInScope = .all
                        }
                    }

                    OptionPillRow(
                        title: "Neighbors Only",
                        icon: "person.2.fill",
                        isSelected: gameVM.throwInScope == .neighbor
                    ) {
                        withAnimation(.interactiveSpring(response: 0.2, dampingFraction: 0.8)) {
                            gameVM.throwInScope = .neighbor
                        }
                    }
                }
            }

            // Mode
            VStack(alignment: .leading, spacing: 6) {
                Label("GAMEPLAY STYLE", systemImage: "sparkles")
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(2)

                HStack(spacing: 10) {
                    OptionPillRow(
                        title: "Classic Durak",
                        icon: "suit.club.fill",
                        isSelected: gameVM.playStyle == .standard
                    ) {
                        withAnimation(.interactiveSpring(response: 0.2, dampingFraction: 0.8)) {
                            gameVM.playStyle = .standard
                        }
                    }

                    OptionPillRow(
                        title: "Skills & Powers",
                        icon: "wand.and.stars",
                        isSelected: gameVM.playStyle == .abilities
                    ) {
                        withAnimation(.interactiveSpring(response: 0.2, dampingFraction: 0.8)) {
                            gameVM.playStyle = .abilities
                        }
                    }
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

    // MARK: - Turn Timer

    private var turnTimerSection: some View {
        let options = [10, 12, 15, 30]
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack {
                Label("TURN TIMER", systemImage: "timer")
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(2)
                Spacer()
                Text("Longer helps on slow Wi‑Fi")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
            }

            HStack(spacing: 8) {
                ForEach(options, id: \.self) { seconds in
                    let isSelected = gameVM.turnTimerSeconds == seconds
                    Button {
                        withAnimation(.interactiveSpring(response: 0.2, dampingFraction: 0.8)) {
                            gameVM.turnTimerSeconds = seconds
                            PreferencesStore.shared.turnSeconds = seconds
                        }
                    } label: {
                        Text("\(seconds)s")
                            .font(DesignTokens.Typography.caption)
                            .fontWeight(isSelected ? .bold : .medium)
                            .foregroundStyle(isSelected ? theme.ui.accentText : DesignTokens.Colors.textLight)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                                    .fill(isSelected ? theme.ui.selectionBg : Color.white.opacity(0.06))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                                    .stroke(isSelected ? theme.ui.selectionBorder : theme.ui.surfaceBorder, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.springPressable(feedback: .selection))
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
        .onAppear {
            gameVM.turnTimerSeconds = PreferencesStore.shared.turnSeconds
        }
    }

    // MARK: - Start Button Section

    private var actionButtonSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            // Match Summary Pill
            let summaryText = "\(gameVM.numPlayers) Players • \(gameVM.variant == .podkidnoy ? "Podkidnoy" : "Perevodnoy") • \(gameVM.playStyle == .standard ? "Classic" : "Skills")"

            Text(summaryText)
                .font(DesignTokens.Typography.caption)
                .foregroundStyle(DesignTokens.Colors.textMuted)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(Capsule().fill(Color.white.opacity(0.06)))
                .padding(.bottom, DesignTokens.Spacing.xl)

            // Instant Solo vs AI Button (0ms network delay)
            Button {
                startInstantSoloMatch()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "bolt.fill")
                        .font(.headline)
                    Text("QUICK PLAY VS AI")
                        .font(DesignTokens.Typography.heading)
                        .fontWeight(.bold)
                        .tracking(2)
                }
                .foregroundStyle(theme.ui.accentText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(
                    LinearGradient(
                        colors: theme.ui.accentGradient,
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                )
                .shadow(color: theme.ui.accent.opacity(0.45), radius: 14, y: 4)
            }
            .buttonStyle(.springPressable(feedback: .gameStart))
            .disabled(isCreatingRoom)

            // Online Room Button
            Button {
                createOnlineRoom()
            } label: {
                HStack(spacing: 8) {
                    if isCreatingRoom {
                        ProgressView()
                            .tint(theme.ui.accent)
                    } else {
                        Image(systemName: "person.2.wave.2.fill")
                            .font(.subheadline)
                    }
                    Text(isCreatingRoom ? "CREATING ROOM..." : "CREATE ONLINE ROOM & INVITE")
                        .font(DesignTokens.Typography.button)
                        .tracking(1.5)
                        .lineLimit(2)
                        .minimumScaleFactor(0.9)
                        .multilineTextAlignment(.center)
                }
                .foregroundStyle(theme.ui.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .fill(theme.ui.surfaceCard)
                        .overlay(
                            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                .stroke(theme.ui.accent.opacity(0.45), lineWidth: 1.2)
                        )
                )
            }
            .buttonStyle(.springPressable(feedback: .confirm))
            .disabled(isCreatingRoom)
        }
        .padding(.top, DesignTokens.Spacing.md)
    }

    private func startInstantSoloMatch() {
        Task {
            let started = await gameVM.startSoloGame()
            await MainActor.run {
                guard started else {
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
                        createNotice = OnlineErrorCopy.Notice(
                            title: String(localized: "Not enough credits"),
                            detail: gameVM.economyNotice
                                ?? String(localized: "Earn or top up credits, then try again.")
                        )
                    }
                    return
                }
                dismiss()
                router.navigate(to: .game)
            }
        }
    }

    private func createOnlineRoom() {
        guard !isCreatingRoom else { return }
        isCreatingRoom = true
        withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) {
            createNotice = nil
        }

        Task {
            do {
                let res = try await OnlineBridge.shared.createRoom(
                    numPlayers: gameVM.numPlayers,
                    variant: gameVM.variant,
                    throwInScope: gameVM.throwInScope,
                    playStyle: gameVM.playStyle,
                    difficulty: gameVM.difficulty,
                    turnTimerSeconds: gameVM.turnTimerSeconds,
                    buyIn: gameVM.buyIn
                )
                await MainActor.run {
                    gameVM.onlineRoomId = res.roomId
                    gameVM.onlineRoomCode = res.roomCode
                    gameVM.onlineIsHost = true
                    gameVM.playMode = .online
                    isCreatingRoom = false
                    dismiss()
                    router.navigate(to: .lobby)
                }
            } catch {
                await MainActor.run {
                    isCreatingRoom = false
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
                        createNotice = OnlineErrorCopy.createNotice(for: error)
                    }
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }
}

// MARK: - Compact Horizontal Swipe Wheel Picker (Numbers Only + Haptics)

private struct CompactWheelPlayerPicker: View {
    @Environment(ThemeManager.self) private var theme
    @Binding var selectedCount: Int
    private let counts = [2, 3, 4, 5, 6]

    var body: some View {
        GeometryReader { geo in
            let totalWidth = geo.size.width
            let itemWidth = max(20, totalWidth / CGFloat(counts.count))
            let activeIndex = counts.firstIndex(of: selectedCount) ?? 0

            ZStack(alignment: .leading) {
                // Background cylinder trough
                RoundedRectangle(cornerRadius: 14)
                    .fill(theme.ui.surfaceCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                    )

                // Smooth sliding theme selection bezel
                RoundedRectangle(cornerRadius: 11)
                    .fill(
                        LinearGradient(
                            colors: theme.ui.accentGradient,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: max(10, itemWidth - 6), height: 38)
                    .offset(x: CGFloat(activeIndex) * itemWidth + 3)
                    .shadow(color: theme.ui.accent.opacity(0.45), radius: 8, y: 2)
                    .animation(.interactiveSpring(response: 0.22, dampingFraction: 0.76), value: selectedCount)

                // Numbers row with 3D wheel curvature
                HStack(spacing: 0) {
                    ForEach(counts, id: \.self) { count in
                        let isSelected = count == selectedCount
                        let distance = count - selectedCount

                        Text("\(count)")
                            .font(.system(size: isSelected ? 21 : 16, weight: isSelected ? .heavy : .semibold, design: .rounded))
                            .foregroundStyle(isSelected ? theme.ui.accentText : DesignTokens.Colors.textLight.opacity(0.55))
                            .frame(width: itemWidth, height: 44)
                            .contentShape(Rectangle())
                            .scaleEffect(isSelected ? 1.08 : 0.88)
                            .rotation3DEffect(
                                .degrees(Double(distance) * -12),
                                axis: (x: 0, y: 1, z: 0),
                                perspective: 0.6
                            )
                            .animation(.interactiveSpring(response: 0.22, dampingFraction: 0.76), value: selectedCount)
                            .onTapGesture {
                                if selectedCount != count {
                                    selectedCount = count
                                }
                            }
                    }
                }
            }
            // Bound + clip so 3D/scale overflow cannot widen the parent ScrollView.
            .frame(width: totalWidth, alignment: .leading)
            .clipped()
            .highPriorityGesture(
                DragGesture(minimumDistance: 4)
                    .onChanged { value in
                        let clampedX = max(0, min(totalWidth - 1, value.location.x))
                        let targetIndex = Int(clampedX / itemWidth)
                        let boundedIndex = min(max(targetIndex, 0), counts.count - 1)
                        let newCount = counts[boundedIndex]
                        if newCount != selectedCount {
                            selectedCount = newCount
                        }
                    }
            )
        }
        .frame(height: 44)
        .padding(.vertical, 4)
    }
}

// MARK: - Supporting Subviews

private struct VariantCardRow: View {
    @Environment(ThemeManager.self) private var theme
    let title: LocalizedStringKey
    let subtitle: LocalizedStringKey
    let desc: LocalizedStringKey
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(isSelected ? theme.ui.accentSoft : Color.white.opacity(0.06))
                        .frame(width: 42, height: 42)

                    Image(systemName: icon)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(isSelected ? theme.ui.accent : DesignTokens.Colors.textMuted)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(title)
                            .font(DesignTokens.Typography.heading)
                            .fontWeight(.bold)
                            .foregroundStyle(isSelected ? theme.ui.accent : DesignTokens.Colors.textLight)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)

                        Text(subtitle)
                            .font(.caption2)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)

                        Spacer(minLength: 4)

                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(isSelected ? theme.ui.accent : Color.white.opacity(0.2))
                    }

                    Text(desc)
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.textMuted)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(DesignTokens.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                    .fill(isSelected ? theme.ui.surfaceCard : theme.ui.surfaceGlass)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                            .stroke(isSelected ? theme.ui.surfaceBorderHighlighted : theme.ui.surfaceBorder, lineWidth: isSelected ? 1.5 : 1)
                    )
            )
            .shadow(color: isSelected ? theme.ui.accent.opacity(0.25) : .clear, radius: 10, y: 3)
        }
        .buttonStyle(.springPressable(feedback: .uiTap))
    }
}

private struct OptionPillRow: View {
    @Environment(ThemeManager.self) private var theme
    let title: LocalizedStringKey
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(DesignTokens.Typography.caption)
                    .fontWeight(isSelected ? .bold : .medium)
            }
            .foregroundStyle(isSelected ? theme.ui.accentText : DesignTokens.Colors.textLight)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                    .fill(isSelected ? theme.ui.selectionBg : Color.white.opacity(0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                    .stroke(isSelected ? theme.ui.selectionBorder : theme.ui.surfaceBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.springPressable(feedback: .selection))
    }
}
