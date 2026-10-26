import SwiftUI
import AuthenticationServices

/// Settings view — account & cloud backup, appearance, sound, haptics, turn timer.
///
/// Port of `SettingsModal.tsx` & `AccountSection.tsx`.
struct SettingsView: View {
    @Environment(ThemeManager.self) private var theme
    @Environment(AppRouter.self) private var router
    @Environment(\.dismiss) private var dismiss

    @State private var prefs = PreferencesStore.shared
    @State private var auth = ConvexAuth.shared
    @State private var economy = EconomyStore.shared
    @State private var playerNameStore = PlayerNameStore.shared

    @State private var nameDraft: String = PlayerNameStore.shared.name
    @State private var nameSavedToast: Bool = false
    @State private var presentedAuthMode: ConvexAuth.PasswordAuthFlow? = nil
    @State private var showDisplayNamePrompt: Bool = false
    @State private var isAppleBusy: Bool = false
    @State private var isSigningOut: Bool = false
    @State private var showSignOutConfirm: Bool = false
    @State private var showDeleteConfirm: Bool = false
    @State private var accountError: String? = nil

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
                sheetHeader

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                        // 1. Account & Progress
                        settingsSection(title: "ACCOUNT & PROGRESS", icon: "person.crop.circle.fill") {
                            accountContent
                        }

                        // 2. Feedback
                        settingsSection(title: "FEEDBACK", icon: "waveform") {
                            feedbackContent
                        }

                        // 3. Turn Timer
                        settingsSection(title: "TURN TIMER (SOLO)", icon: "stopwatch.fill") {
                            timerContent
                        }

                        // 4. Appearance
                        settingsSection(title: "APPEARANCE THEME", icon: "paintpalette.fill") {
                            appearanceContent
                        }

                        // 5. Legal / attribution
                        settingsSection(title: "ABOUT", icon: "info.circle.fill") {
                            aboutContent
                        }
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxContentWidth)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.sm)
                    .padding(.bottom, DesignTokens.Spacing.xxl)
                    .frame(maxWidth: .infinity)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .onAppear {
            nameDraft = playerNameStore.name
            if auth.hasWalletSession {
                Task {
                    await ConvexAuth.shared.refreshWallet()
                }
            }
        }
        .onChange(of: playerNameStore.name) { _, newValue in
            nameDraft = newValue
        }
        .sheet(item: $presentedAuthMode) { mode in
            AuthSheet(initialMode: mode) {
                nameDraft = playerNameStore.name
            }
            .environment(theme)
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showDisplayNamePrompt) {
            DisplayNamePromptSheet {
                nameDraft = playerNameStore.name
            }
            .environment(theme)
        }
        .alert("Sign Out?", isPresented: $showSignOutConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Sign Out", role: .destructive) {
                performSignOut()
            }
        } message: {
            Text("You can sign back in anytime to access your backed-up Gold, Credits, and profile.")
        }
        .alert("Delete Account?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete Permanently", role: .destructive) {
                performDeleteAccount()
            }
        } message: {
            Text("This will permanently delete your account, handle, wallet balance, and friend list. This action cannot be undone.")
        }
    }

    private var sheetHeader: some View {
        HStack {
            Color.clear.frame(width: 50, height: 32)
            Spacer()
            Text("Settings")
                .font(DesignTokens.Typography.heading)
                .foregroundStyle(DesignTokens.Colors.textLight)
            Spacer()
            Button("Done") {
                saveDisplayNameIfChanged()
                dismiss()
            }
            .font(DesignTokens.Typography.body)
            .fontWeight(.semibold)
            .foregroundStyle(theme.ui.accent)
            .frame(width: 50, alignment: .trailing)
            .buttonStyle(.springPressable(scale: 0.94, feedback: .uiTap))
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.md)
        .padding(.bottom, DesignTokens.Spacing.sm)
    }

    private func settingsSection<Content: View>(
        title: LocalizedStringKey,
        icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Label(title, systemImage: icon)
                .font(DesignTokens.Typography.caption)
                .fontWeight(.bold)
                .foregroundStyle(DesignTokens.Colors.textMuted)
                .tracking(2)

            content()
        }
    }

    // MARK: - Account Section

    @ViewBuilder
    private var accountContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // A. Identity Status Header + Cloud Badge
            HStack(spacing: DesignTokens.Spacing.md) {
                ZStack {
                    Circle()
                        .fill(auth.isGuest ? theme.ui.accentSoft : DesignTokens.Colors.success.opacity(0.18))
                        .frame(width: 46, height: 46)
                        .overlay(
                            Circle()
                                .stroke(
                                    auth.isGuest ? theme.ui.accent.opacity(0.45) : DesignTokens.Colors.success.opacity(0.6),
                                    lineWidth: 1.2
                                )
                        )

                    Image(systemName: auth.isGuest ? "person.fill.questionmark" : "checkmark.seal.fill")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(auth.isGuest ? theme.ui.accent : DesignTokens.Colors.success)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text(playerNameStore.name)
                            .font(DesignTokens.Typography.heading)
                            .foregroundStyle(DesignTokens.Colors.textLight)
                            .lineLimit(1)

                        // Account Kind Pill Badge (GUEST / APPLE ID / EMAIL)
                        HStack(spacing: 4) {
                            Image(systemName: auth.accountKind.iconName)
                                .font(.system(size: 9, weight: .bold))
                            Text(auth.accountKind.badgeLabel)
                                .font(.system(size: 9, weight: .heavy))
                                .tracking(0.8)
                        }
                        .foregroundStyle(auth.isGuest ? theme.ui.accent : theme.ui.accentText)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(
                            Capsule()
                                .fill(auth.isGuest ? theme.ui.accentSoft : theme.ui.accent)
                        )
                    }

                    if auth.isGuest {
                        Text("Guest session • Local device storage only")
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                    } else {
                        let displayEmail: String? = {
                            guard let email = auth.userEmail, !email.isEmpty else { return nil }
                            if email.hasSuffix("@appleid.durak.app") {
                                return "Apple ID Private Relay"
                            }
                            return email
                        }()
                        if let handle = auth.userHandle, !handle.isEmpty {
                            Text("@\(handle)" + (displayEmail.map { " • \($0)" } ?? ""))
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                                .lineLimit(1)
                        } else if let displayEmail {
                            Text(displayEmail)
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                                .lineLimit(1)
                        } else {
                            Text("Progress & economy safely backed up")
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                        }
                    }
                }

                Spacer(minLength: 0)
            }

            // B. Economy Snapshot Bar
            HStack(spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "crown.fill")
                        .font(.caption)
                        .foregroundStyle(DesignTokens.Colors.gold)
                    Text("\(economy.gold) Gold")
                        .font(DesignTokens.Typography.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(DesignTokens.Colors.textLight)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(theme.ui.surfaceCard)
                )

                HStack(spacing: 6) {
                    Image(systemName: "suit.diamond.fill")
                        .font(.caption)
                        .foregroundStyle(theme.ui.accent)
                    Text("\(economy.credits) Credits")
                        .font(DesignTokens.Typography.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(DesignTokens.Colors.textLight)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(theme.ui.surfaceCard)
                )

                Spacer()

                HStack(spacing: 4) {
                    Image(systemName: auth.isGuest ? "icloud.slash" : "icloud.fill")
                        .font(.caption2)
                    Text(auth.isGuest ? "Not Synced" : "Cloud Synced")
                        .font(DesignTokens.Typography.captionSmall)
                }
                .foregroundStyle(auth.isGuest ? DesignTokens.Colors.textFaint : DesignTokens.Colors.success)
            }

            Divider()
                .overlay(theme.ui.surfaceBorder)

            // C. Display Name Editor Row
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("DISPLAY NAME")
                        .font(DesignTokens.Typography.label)
                        .foregroundStyle(DesignTokens.Colors.textMuted)
                        .tracking(1.6)
                    Spacer()
                    if nameSavedToast {
                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Saved")
                        }
                        .font(DesignTokens.Typography.captionSmall)
                        .foregroundStyle(DesignTokens.Colors.success)
                        .transition(.opacity)
                    }
                }

                HStack(spacing: 8) {
                    Image(systemName: "person.text.rectangle")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(theme.ui.accent)

                    TextField("Player Name", text: $nameDraft)
                        .font(DesignTokens.Typography.body)
                        .foregroundStyle(DesignTokens.Colors.textLight)
                        .autocorrectionDisabled()
                        .submitLabel(.done)
                        .onSubmit {
                            saveDisplayNameIfChanged()
                        }

                    let trimmed = nameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty && trimmed != playerNameStore.name {
                        Button("Save") {
                            saveDisplayNameIfChanged()
                        }
                        .font(DesignTokens.Typography.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(theme.ui.accentText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule().fill(theme.ui.accent)
                        )
                        .buttonStyle(.springPressable(scale: 0.94, feedback: .confirm))
                    }
                }
                .padding(.horizontal, 12)
                .frame(height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 11)
                        .fill(theme.ui.surfaceCard)
                        .overlay(
                            RoundedRectangle(cornerRadius: 11)
                                .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                        )
                )
            }

            if let err = accountError {
                Text(err)
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.danger)
            }

            // D. Auth Actions (Guest Upgrade vs Signed-In Management)
            if auth.isGuest {
                Text("Sign in with Apple or Email to preserve your Gold, Credits, and match statistics across devices.")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textMuted)

                // 1. Sign in with Apple
                Button {
                    handleAppleSignIn()
                } label: {
                    HStack(spacing: 8) {
                        if isAppleBusy {
                            ProgressView()
                                .tint(.black)
                        } else {
                            Image(systemName: "apple.logo")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        Text(isAppleBusy ? "Signing in with Apple…" : "Sign in with Apple")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(Color.black)
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.white)
                    )
                    .shadow(color: Color.black.opacity(0.22), radius: 6, y: 2)
                }
                .buttonStyle(.springPressable(scale: 0.97, feedback: .confirm))
                .disabled(isAppleBusy)

                // 2. Email Create Account & Sign In Buttons
                HStack(spacing: 10) {
                    Button {
                        presentedAuthMode = .signUp
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "envelope.badge.fill")
                                .font(.caption)
                            Text("CREATE ACCOUNT")
                                .font(DesignTokens.Typography.caption)
                                .fontWeight(.bold)
                                .tracking(1.0)
                        }
                        .foregroundStyle(theme.ui.accentText)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(
                            LinearGradient(
                                colors: theme.ui.accentGradient,
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                    }
                    .buttonStyle(.springPressable(scale: 0.97, feedback: .uiTap))

                    Button {
                        presentedAuthMode = .signIn
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.right.to.line")
                                .font(.caption)
                            Text("SIGN IN")
                                .font(DesignTokens.Typography.caption)
                                .fontWeight(.bold)
                                .tracking(1.0)
                        }
                        .foregroundStyle(theme.ui.accent)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(theme.ui.surfaceCard)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(theme.ui.accent.opacity(0.45), lineWidth: 1.2)
                                )
                        )
                    }
                    .buttonStyle(.springPressable(scale: 0.97, feedback: .uiTap))
                }
            } else {
                // Signed-In Actions: Sign Out & Delete Account
                HStack(spacing: 10) {
                    Button {
                        showSignOutConfirm = true
                    } label: {
                        HStack(spacing: 6) {
                            if isSigningOut {
                                ProgressView()
                                    .tint(DesignTokens.Colors.textLight)
                            } else {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .font(.caption)
                            }
                            Text(isSigningOut ? "SIGNING OUT..." : "SIGN OUT")
                                .font(DesignTokens.Typography.caption)
                                .fontWeight(.bold)
                                .tracking(1.0)
                        }
                        .foregroundStyle(DesignTokens.Colors.textLight)
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(
                            RoundedRectangle(cornerRadius: 11)
                                .fill(theme.ui.surfaceCard)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 11)
                                        .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                                )
                        )
                    }
                    .buttonStyle(.springPressable(scale: 0.97, feedback: .selection))
                    .disabled(isSigningOut)

                    Button {
                        showDeleteConfirm = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "trash")
                                .font(.caption)
                            Text("DELETE")
                                .font(DesignTokens.Typography.caption)
                                .fontWeight(.bold)
                                .tracking(1.0)
                        }
                        .foregroundStyle(DesignTokens.Colors.danger)
                        .padding(.horizontal, 16)
                        .frame(height: 42)
                        .background(
                            RoundedRectangle(cornerRadius: 11)
                                .fill(DesignTokens.Colors.danger.opacity(0.12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 11)
                                        .stroke(DesignTokens.Colors.danger.opacity(0.35), lineWidth: 1)
                                )
                        )
                    }
                    .buttonStyle(.springPressable(scale: 0.97, feedback: .selection))
                    .disabled(isSigningOut)
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

    // MARK: - Account Helper Actions

    private func saveDisplayNameIfChanged() {
        let trimmed = nameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != playerNameStore.name else { return }
        Task {
            await auth.updateDisplayName(trimmed)
            await MainActor.run {
                withAnimation {
                    nameSavedToast = true
                }
                FeedbackManager.shared.trigger(.confirm)
            }
            try? await Task.sleep(for: .seconds(2))
            await MainActor.run {
                withAnimation {
                    nameSavedToast = false
                }
            }
        }
    }

    private func handleAppleSignIn() {
        guard !isAppleBusy else { return }
        accountError = nil
        isAppleBusy = true

        AppleSignInCoordinator.shared.requestSignIn { outcome in
            Task { @MainActor in
                switch outcome {
                case .success(let credential):
                    do {
                        try await auth.signInWithApple(credential: credential)
                        isAppleBusy = false
                        FeedbackManager.shared.trigger(.confirm)
                        finishAppleSignIn()
                    } catch {
                        isAppleBusy = false
                        accountError = error.localizedDescription
                        FeedbackManager.shared.trigger(.failure)
                    }
                case .simulatorFallback:
                    do {
                        try await auth.signInWithAppleSimulatorFallback()
                        isAppleBusy = false
                        FeedbackManager.shared.trigger(.confirm)
                        finishAppleSignIn()
                    } catch {
                        isAppleBusy = false
                        accountError = error.localizedDescription
                        FeedbackManager.shared.trigger(.failure)
                    }
                case .cancelled:
                    isAppleBusy = false
                case .failure(let error):
                    isAppleBusy = false
                    accountError = error.localizedDescription
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }

    private func finishAppleSignIn() {
        nameDraft = playerNameStore.name
        if auth.needsDisplayNamePrompt {
            showDisplayNamePrompt = true
        }
    }

    private func performSignOut() {
        guard !isSigningOut else { return }
        isSigningOut = true
        Task {
            await auth.signOut(mintFreshGuest: false)
            await MainActor.run {
                isSigningOut = false
                FeedbackManager.shared.trigger(.confirm)
                dismiss()
                router.navigate(to: .welcome)
            }
        }
    }

    private func performDeleteAccount() {
        guard !isSigningOut else { return }
        isSigningOut = true
        Task {
            do {
                try await auth.deleteAccount()
                await MainActor.run {
                    isSigningOut = false
                    FeedbackManager.shared.trigger(.confirm)
                    dismiss()
                    router.navigate(to: .welcome)
                }
            } catch {
                await MainActor.run {
                    isSigningOut = false
                    accountError = "Could not delete account: \(error.localizedDescription)"
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }

    // MARK: - Feedback Section

    private var feedbackContent: some View {
        VStack(spacing: 12) {
            Toggle(isOn: Binding(
                get: { prefs.soundEnabled },
                set: { newValue in
                    prefs.soundEnabled = newValue
                    if newValue { FeedbackManager.shared.trigger(.selection) }
                }
            )) {
                HStack(spacing: 10) {
                    Image(systemName: prefs.soundEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                        .foregroundStyle(theme.ui.accent)
                        .frame(width: 22)
                    Text("Sound Effects")
                        .font(DesignTokens.Typography.body)
                        .foregroundStyle(DesignTokens.Colors.textLight)
                }
            }
            .tint(theme.ui.accent)

            Divider()
                .overlay(theme.ui.surfaceBorder)

            Toggle(isOn: Binding(
                get: { prefs.hapticsEnabled },
                set: { newValue in
                    prefs.hapticsEnabled = newValue
                    if newValue { FeedbackManager.shared.trigger(.selection) }
                }
            )) {
                HStack(spacing: 10) {
                    Image(systemName: "iphone.radiowaves.left.and.right")
                        .foregroundStyle(theme.ui.accent)
                        .frame(width: 22)
                    Text("Haptic Feedback")
                        .font(DesignTokens.Typography.body)
                        .foregroundStyle(DesignTokens.Colors.textLight)
                }
            }
            .tint(theme.ui.accent)
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

    // MARK: - Turn Timer Section

    private var timerContent: some View {
        let options = [10, 12, 15, 30]
        return HStack(spacing: 8) {
            ForEach(options, id: \.self) { seconds in
                let isSelected = prefs.turnSeconds == seconds
                Button {
                    withAnimation(.interactiveSpring(response: 0.2, dampingFraction: 0.8)) {
                        prefs.turnSeconds = seconds
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
        .padding(DesignTokens.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                )
        )
    }

    // MARK: - Appearance Section

    private var appearanceContent: some View {
        VStack(spacing: 8) {
            ForEach(appearanceOrder, id: \.self) { id in
                let preset = getAppearance(id)
                let isSelected = theme.activeAppearanceId == id
                Button {
                    withAnimation(.interactiveSpring(response: 0.24, dampingFraction: 0.82)) {
                        theme.activeAppearanceId = id
                    }
                } label: {
                    HStack(spacing: DesignTokens.Spacing.md) {
                        // Color swatch
                        RoundedRectangle(cornerRadius: 8)
                            .fill(
                                LinearGradient(
                                    colors: preset.table.gradient ?? [preset.table.backgroundColor],
                                    startPoint: .top, endPoint: .bottom
                                )
                            )
                            .frame(width: 40, height: 40)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(isSelected ? preset.ui.accent : Color.white.opacity(0.15), lineWidth: isSelected ? 2.5 : 1)
                            )
                            .shadow(color: isSelected ? preset.ui.accent.opacity(0.4) : Color.clear, radius: 6)

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(preset.name)
                                    .font(DesignTokens.Typography.body)
                                    .fontWeight(isSelected ? .bold : .medium)
                                    .foregroundStyle(isSelected ? theme.ui.accent : DesignTokens.Colors.textLight)

                                if isSelected {
                                    Text("ACTIVE")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(theme.ui.accentText)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Capsule().fill(theme.ui.accent))
                                }
                            }

                            Text(preset.tagline)
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textFaint)
                        }

                        Spacer()

                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                            .font(.title3)
                            .foregroundStyle(isSelected ? theme.ui.accent : Color.white.opacity(0.18))
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                            .fill(isSelected ? theme.ui.surfaceCard : theme.ui.surfaceGlass)
                            .overlay(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                                    .stroke(isSelected ? theme.ui.surfaceBorderHighlighted : theme.ui.surfaceBorder, lineWidth: isSelected ? 1.5 : 1)
                            )
                    )
                }
                .buttonStyle(.springPressable(scale: 0.98, feedback: .selection))
            }
        }
    }

    // MARK: - About / attribution

    private var aboutContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Animated emoji by Google Noto Color Emoji (CC BY 4.0).")
                .font(DesignTokens.Typography.caption)
                .foregroundStyle(DesignTokens.Colors.textMuted)
                .fixedSize(horizontal: false, vertical: true)

            if let url = URL(string: "https://googlefonts.github.io/noto-emoji-animation/") {
                Link(destination: url) {
                    Text("Noto Animated Emoji")
                        .font(DesignTokens.Typography.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(theme.ui.accent)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                .fill(theme.ui.surfaceGlass)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                        .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                )
        )
    }
}
