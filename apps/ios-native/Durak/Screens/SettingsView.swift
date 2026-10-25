import SwiftUI
import AuthenticationServices

/// Settings view — appearance, sound, haptics, turn timer, account.
///
/// Port of `SettingsModal.tsx`.
struct SettingsView: View {
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    @AppStorage("soundEnabled") private var soundEnabled = true
    @AppStorage("hapticsEnabled") private var hapticsEnabled = true
    @AppStorage("turnTimerSeconds") private var turnTimerSeconds = 12
    @AppStorage("appleUserId") private var appleUserId = ""
    @AppStorage("appleUserName") private var appleUserName = ""

    var body: some View {
        @Bindable var tm = theme

        NavigationStack {
            ZStack {
                // Background matching active table theme
                LinearGradient(
                    colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                List {
                // Account & Progress
                Section("Account & Progress") {
                    if !appleUserId.isEmpty {
                        HStack(spacing: DesignTokens.Spacing.md) {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.title2)
                                .foregroundStyle(DesignTokens.Colors.success)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(appleUserName.isEmpty ? "Apple Account Linked" : appleUserName)
                                    .font(DesignTokens.Typography.heading)
                                    .foregroundStyle(DesignTokens.Colors.textLight)

                                Text("Progress & economy safely backed up")
                                    .font(DesignTokens.Typography.caption)
                                    .foregroundStyle(DesignTokens.Colors.textMuted)
                            }

                            Spacer()

                            Button("Sign Out") {
                                FeedbackManager.shared.trigger(.selection)
                                appleUserId = ""
                                appleUserName = ""
                            }
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.danger)
                        }
                        .padding(.vertical, 4)
                    } else {
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                            Text("Play as Guest or sign in to preserve your Gold, Credits, and match statistics across devices.")
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textMuted)

                            SignInWithAppleButton(.signIn) { request in
                                request.requestedScopes = [.fullName, .email]
                            } onCompletion: { result in
                                switch result {
                                case .success(let authorization):
                                    if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
                                        appleUserId = appleIDCredential.user
                                        if let name = appleIDCredential.fullName {
                                            let formatted = [name.givenName, name.familyName].compactMap { $0 }.joined(separator: " ")
                                            if !formatted.isEmpty {
                                                appleUserName = formatted
                                                PlayerNameStore.shared.name = formatted
                                            }
                                        }
                                        FeedbackManager.shared.trigger(.confirm)
                                    }
                                case .failure:
                                    FeedbackManager.shared.trigger(.failure)
                                }
                            }
                            .signInWithAppleButtonStyle(.white)
                            .frame(height: 44)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .padding(.vertical, 4)
                    }
                }

                // Appearance
                Section("Appearance") {
                    ForEach(appearanceOrder, id: \.self) { id in
                        let preset = getAppearance(id)
                        let isSelected = theme.activeAppearanceId == id
                        Button {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                theme.activeAppearanceId = id
                            }
                            FeedbackManager.shared.trigger(.selection)
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
                                    .frame(width: 42, height: 42)
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

                                if isSelected {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.title3)
                                        .foregroundStyle(theme.ui.accent)
                                }
                            }
                        }
                    }
                }

                // Sound & Haptics
                Section("Feedback") {
                    Toggle("Sound Effects", isOn: $soundEnabled)
                        .tint(theme.ui.accent)
                    Toggle("Haptic Feedback", isOn: $hapticsEnabled)
                        .tint(theme.ui.accent)
                }

                // Turn Timer
                Section("Turn Timer (Solo)") {
                    Picker("Duration", selection: $turnTimerSeconds) {
                        Text("10s").tag(10)
                        Text("12s").tag(12)
                        Text("15s").tag(15)
                        Text("30s").tag(30)
                    }
                    .pickerStyle(.segmented)
                }
            }
            .scrollContentBackground(.hidden)
            .tint(theme.ui.accent)
        }
        .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                        .foregroundStyle(theme.ui.accent)
                }
            }
        }
    }
}
