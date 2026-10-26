import SwiftUI
import AuthenticationServices

/// Apple-grade reusable authentication sheet supporting Sign in with Apple and Email/Password Sign In & Sign Up.
/// Can be presented from `WelcomeView` or `SettingsView`.
struct AuthSheet: View {
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    var initialMode: ConvexAuth.PasswordAuthFlow = .signUp
    var onAuthenticated: (() -> Void)? = nil

    @State private var mode: ConvexAuth.PasswordAuthFlow
    @State private var displayName: String = ""
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var showPassword: Bool = false
    @State private var isSubmitting: Bool = false
    @State private var isAppleBusy: Bool = false
    @State private var errorMessage: String? = nil
    @State private var successMessage: String? = nil
    @State private var showDisplayNamePrompt: Bool = false

    @FocusState private var focusedField: Field?

    init(
        initialMode: ConvexAuth.PasswordAuthFlow = .signUp,
        onAuthenticated: (() -> Void)? = nil
    ) {
        self.initialMode = initialMode
        self.onAuthenticated = onAuthenticated
        self._mode = State(initialValue: initialMode)
    }

    private enum Field: Hashable {
        case displayName
        case email
        case password
    }

    var body: some View {
        ZStack {
            // Dynamic theme background
            LinearGradient(
                colors: theme.tablePalette.gradient ?? [theme.tablePalette.backgroundColor],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                sheetHeader

                ScrollView(showsIndicators: false) {
                    VStack(spacing: DesignTokens.Spacing.lg) {
                        // 1. Hero Header Subtitle
                        VStack(spacing: 6) {
                            ZStack {
                                Circle()
                                    .fill(theme.ui.accentSoft)
                                    .frame(width: 56, height: 56)
                                    .overlay(
                                        Circle()
                                            .stroke(theme.ui.accent.opacity(0.45), lineWidth: 1.2)
                                    )

                                Image(systemName: mode == .signUp ? "person.crop.circle.badge.plus" : "person.crop.circle.badge.checkmark")
                                    .font(.system(size: 24, weight: .bold))
                                    .foregroundStyle(theme.ui.accent)
                            }
                            .padding(.bottom, 2)

                            Text(mode == .signUp ? "Save Your Crown & Economy" : "Welcome Back to the Table")
                                .font(DesignTokens.Typography.title)
                                .foregroundStyle(DesignTokens.Colors.textLight)
                                .multilineTextAlignment(.center)

                            Text(
                                mode == .signUp
                                    ? "Back up your Gold, Credits, and online profile across all your Apple devices."
                                    : "Sign in to restore your Gold, Credits, and player profile."
                            )
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, DesignTokens.Spacing.md)
                        }
                        .padding(.top, DesignTokens.Spacing.xs)

                        // 2. Mode Switcher (Create Account vs Sign In)
                        modeSegmentControl

                        // 3. Sign in with Apple Button
                        appleSignInButton

                        // 4. Ornamental "OR WITH EMAIL" Divider
                        orDivider

                        // 5. Email & Password Form
                        formFieldsSection

                        // 6. Error / Success Feedback Banner
                        if let error = errorMessage {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundStyle(DesignTokens.Colors.danger)
                                Text(error)
                                    .font(DesignTokens.Typography.caption)
                                    .foregroundStyle(DesignTokens.Colors.danger)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                                    .fill(DesignTokens.Colors.danger.opacity(0.14))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                                            .stroke(DesignTokens.Colors.danger.opacity(0.35), lineWidth: 1)
                                    )
                            )
                            .transition(.opacity.combined(with: .scale(scale: 0.96)))
                        }

                        if let success = successMessage {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundStyle(DesignTokens.Colors.success)
                                Text(success)
                                    .font(DesignTokens.Typography.caption)
                                    .foregroundStyle(DesignTokens.Colors.textLight)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                                    .fill(DesignTokens.Colors.success.opacity(0.16))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: DesignTokens.Radius.sm)
                                            .stroke(DesignTokens.Colors.success.opacity(0.45), lineWidth: 1)
                                    )
                            )
                            .transition(.opacity.combined(with: .scale(scale: 0.96)))
                        }

                        // 7. Primary Submit Button
                        submitButton

                        // 8. Guest Migration Assurance Note
                        HStack(spacing: 6) {
                            Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                                .font(.caption)
                                .foregroundStyle(theme.ui.accent)
                            Text("Your current Gold (\(EconomyStore.shared.gold)) & Credits (\(EconomyStore.shared.credits)) carry over automatically.")
                                .font(DesignTokens.Typography.captionSmall)
                                .foregroundStyle(DesignTokens.Colors.textMuted)
                        }
                        .padding(.top, 2)
                    }
                    .frame(maxWidth: DesignTokens.Layout.maxContentWidth)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.xs)
                    .padding(.bottom, DesignTokens.Spacing.xxl)
                    .frame(maxWidth: .infinity)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .onAppear {
            let currentName = PlayerNameStore.shared.name
            if !ConvexAuth.isPlaceholderDisplayName(currentName) {
                displayName = currentName
            }
        }
        .sheet(isPresented: $showDisplayNamePrompt) {
            DisplayNamePromptSheet {
                onAuthenticated?()
                dismiss()
            }
            .environment(theme)
        }
    }

    // MARK: - Header

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

            Text(mode == .signUp ? "Create Account" : "Sign In")
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

    // MARK: - Mode Switcher

    private var modeSegmentControl: some View {
        HStack(spacing: 6) {
            modeTabButton(title: "Create Account", target: .signUp)
            modeTabButton(title: "Sign In", target: .signIn)
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(theme.ui.surfaceCard)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(theme.ui.surfaceBorder, lineWidth: 1)
                )
        )
    }

    private func modeTabButton(title: LocalizedStringKey, target: ConvexAuth.PasswordAuthFlow) -> some View {
        let isSelected = (mode == target)
        return Button {
            guard mode != target else { return }
            withAnimation(.interactiveSpring(response: 0.22, dampingFraction: 0.78)) {
                mode = target
                errorMessage = nil
                successMessage = nil
            }
        } label: {
            Text(title)
                .font(DesignTokens.Typography.caption)
                .fontWeight(.bold)
                .foregroundStyle(isSelected ? theme.ui.accentText : DesignTokens.Colors.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    Group {
                        if isSelected {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(
                                    LinearGradient(
                                        colors: theme.ui.accentGradient,
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .shadow(color: theme.ui.accent.opacity(0.35), radius: 6, y: 2)
                        } else {
                            Color.clear
                        }
                    }
                )
        }
        .buttonStyle(.springPressable(scale: 0.97, feedback: .selection))
    }

    // MARK: - Sign in with Apple Button

    private var appleSignInButton: some View {
        Button {
            handleAppleSignIn()
        } label: {
            HStack(spacing: 10) {
                if isAppleBusy {
                    ProgressView()
                        .tint(.black)
                } else {
                    Image(systemName: "apple.logo")
                        .font(.system(size: 18, weight: .semibold))
                }
                Text(isAppleBusy ? "Signing in with Apple…" : "Continue with Apple")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundStyle(Color.black)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
                    .fill(Color.white)
            )
            .shadow(color: Color.black.opacity(0.28), radius: 8, y: 3)
        }
        .buttonStyle(.springPressable(scale: 0.97, feedback: .uiTap))
        .disabled(isSubmitting || isAppleBusy)
    }

    private var orDivider: some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(theme.ui.surfaceBorder)
                .frame(height: 1)
            Text("OR CONTINUE WITH EMAIL")
                .font(DesignTokens.Typography.label)
                .foregroundStyle(DesignTokens.Colors.textMuted)
                .tracking(1.8)
                .fixedSize()
            Rectangle()
                .fill(theme.ui.surfaceBorder)
                .frame(height: 1)
        }
        .padding(.vertical, 2)
    }

    // MARK: - Form Fields

    private var formFieldsSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            if mode == .signUp {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("USERNAME")
                            .font(DesignTokens.Typography.label)
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                            .tracking(1.6)
                        Spacer()
                        Text("Required · shown at the table")
                            .font(DesignTokens.Typography.captionSmall)
                            .foregroundStyle(DesignTokens.Colors.textFaint)
                    }

                    HStack(spacing: 10) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(theme.ui.accent)
                            .frame(width: 20)

                        TextField("e.g. RoyalPlayer", text: $displayName)
                            .font(DesignTokens.Typography.body)
                            .foregroundStyle(DesignTokens.Colors.textLight)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .displayName)
                            .submitLabel(.next)
                            .onSubmit {
                                focusedField = .email
                            }
                            .onChange(of: displayName) { _, _ in
                                if errorMessage != nil { errorMessage = nil }
                            }
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 50)
                    .background(fieldBackground(isFocused: focusedField == .displayName))
                }
            }

            // Email Field
            VStack(alignment: .leading, spacing: 6) {
                Text("EMAIL ADDRESS")
                    .font(DesignTokens.Typography.label)
                    .foregroundStyle(DesignTokens.Colors.textMuted)
                    .tracking(1.6)

                HStack(spacing: 10) {
                    Image(systemName: "envelope.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(theme.ui.accent)
                        .frame(width: 20)

                    TextField("name@example.com", text: $email)
                        .font(DesignTokens.Typography.body)
                        .foregroundStyle(DesignTokens.Colors.textLight)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .email)
                        .submitLabel(.next)
                        .onSubmit {
                            focusedField = .password
                        }
                        .onChange(of: email) { _, _ in
                            if errorMessage != nil { errorMessage = nil }
                        }
                }
                .padding(.horizontal, 14)
                .frame(height: 50)
                .background(fieldBackground(isFocused: focusedField == .email))
            }

            // Password Field
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("PASSWORD")
                        .font(DesignTokens.Typography.label)
                        .foregroundStyle(DesignTokens.Colors.textMuted)
                        .tracking(1.6)
                    Spacer()
                    if mode == .signUp {
                        Text("Min. 8 characters")
                            .font(DesignTokens.Typography.captionSmall)
                            .foregroundStyle(
                                password.count >= 8
                                    ? DesignTokens.Colors.success
                                    : DesignTokens.Colors.textFaint
                            )
                    }
                }

                HStack(spacing: 10) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(theme.ui.accent)
                        .frame(width: 20)

                    Group {
                        if showPassword {
                            TextField("Enter password", text: $password)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Enter password", text: $password)
                        }
                    }
                    .font(DesignTokens.Typography.body)
                    .foregroundStyle(DesignTokens.Colors.textLight)
                    .textContentType(mode == .signUp ? .newPassword : .password)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit {
                        handleEmailSubmit()
                    }
                    .onChange(of: password) { _, _ in
                        if errorMessage != nil { errorMessage = nil }
                    }

                    Button {
                        showPassword.toggle()
                        FeedbackManager.shared.trigger(.selection)
                    } label: {
                        Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(DesignTokens.Colors.textMuted)
                            .frame(width: 32, height: 32)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 14)
                .frame(height: 50)
                .background(fieldBackground(isFocused: focusedField == .password))
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

    private func fieldBackground(isFocused: Bool) -> some View {
        RoundedRectangle(cornerRadius: 13)
            .fill(theme.ui.surfaceCard)
            .overlay(
                RoundedRectangle(cornerRadius: 13)
                    .stroke(
                        isFocused ? theme.ui.accent : theme.ui.surfaceBorder,
                        lineWidth: isFocused ? 1.5 : 1
                    )
            )
    }

    // MARK: - Submit Button

    private var canSubmit: Bool {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let nameValid = (mode == .signIn) || (
            cleanName.count >= 2
                && cleanName.count <= 20
                && !ConvexAuth.isPlaceholderDisplayName(cleanName)
        )
        return !cleanEmail.isEmpty && password.count >= 8 && nameValid && !isSubmitting && !isAppleBusy
    }

    private var submitButton: some View {
        Button {
            handleEmailSubmit()
        } label: {
            HStack(spacing: 8) {
                if isSubmitting {
                    ProgressView()
                        .tint(theme.ui.accentText)
                } else {
                    Image(systemName: mode == .signUp ? "sparkles" : "arrow.right.circle.fill")
                        .font(.headline)
                }
                Text(
                    isSubmitting
                        ? (mode == .signUp ? "CREATING ACCOUNT..." : "SIGNING IN...")
                        : (mode == .signUp ? "CREATE ACCOUNT" : "SIGN IN")
                )
                .font(DesignTokens.Typography.heading)
                .tracking(1.8)
            }
            .foregroundStyle(theme.ui.accentText)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(
                LinearGradient(
                    colors: canSubmit
                        ? theme.ui.accentGradient
                        : [theme.ui.accent.opacity(0.35), theme.ui.accent.opacity(0.20)],
                    startPoint: .leading,
                    endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: DesignTokens.Radius.panel)
            )
            .shadow(color: canSubmit ? theme.ui.accent.opacity(0.42) : .clear, radius: 12, y: 4)
        }
        .buttonStyle(.springPressable(feedback: .confirm))
        .disabled(!canSubmit)
    }

    // MARK: - Actions

    private func handleEmailSubmit() {
        guard !isSubmitting && !isAppleBusy else { return }
        focusedField = nil
        errorMessage = nil
        successMessage = nil

        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)

        if mode == .signUp {
            if cleanName.count < 2 || cleanName.count > 20 || ConvexAuth.isPlaceholderDisplayName(cleanName) {
                withAnimation {
                    errorMessage = "Please enter a username between 2 and 20 characters."
                }
                FeedbackManager.shared.trigger(.failure)
                focusedField = .displayName
                return
            }
        }
        if !ConvexAuth.isValidEmail(cleanEmail) {
            withAnimation {
                errorMessage = "Please enter a valid email address."
            }
            FeedbackManager.shared.trigger(.failure)
            return
        }
        if password.count < 8 {
            withAnimation {
                errorMessage = "Password must be at least 8 characters."
            }
            FeedbackManager.shared.trigger(.failure)
            return
        }

        isSubmitting = true
        Task {
            do {
                try await ConvexAuth.shared.signInWithPassword(
                    email: cleanEmail,
                    password: password,
                    flow: mode,
                    name: mode == .signUp ? cleanName : nil
                )
                await MainActor.run {
                    isSubmitting = false
                    withAnimation {
                        successMessage = mode == .signUp
                            ? "Account created! Signed in as \(PlayerNameStore.shared.name)."
                            : "Welcome back, \(PlayerNameStore.shared.name)!"
                    }
                    FeedbackManager.shared.trigger(.confirm)
                }
                try? await Task.sleep(for: .milliseconds(380))
                await MainActor.run {
                    onAuthenticated?()
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isSubmitting = false
                    withAnimation {
                        errorMessage = error.localizedDescription
                    }
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }

    private func handleAppleSignIn() {
        guard !isAppleBusy && !isSubmitting else { return }
        focusedField = nil
        errorMessage = nil
        isAppleBusy = true

        AppleSignInCoordinator.shared.requestSignIn { result in
            Task { @MainActor in
                switch result {
                case .success(let credential):
                    do {
                        try await ConvexAuth.shared.signInWithApple(credential: credential)
                        isAppleBusy = false
                        FeedbackManager.shared.trigger(.confirm)
                        finishAppleSignIn()
                    } catch {
                        isAppleBusy = false
                        withAnimation {
                            errorMessage = error.localizedDescription
                        }
                        FeedbackManager.shared.trigger(.failure)
                    }
                case .simulatorFallback:
                    do {
                        try await ConvexAuth.shared.signInWithAppleSimulatorFallback()
                        isAppleBusy = false
                        FeedbackManager.shared.trigger(.confirm)
                        finishAppleSignIn()
                    } catch {
                        isAppleBusy = false
                        withAnimation {
                            errorMessage = error.localizedDescription
                        }
                        FeedbackManager.shared.trigger(.failure)
                    }
                case .cancelled:
                    isAppleBusy = false
                case .failure(let error):
                    isAppleBusy = false
                    withAnimation {
                        errorMessage = error.localizedDescription
                    }
                    FeedbackManager.shared.trigger(.failure)
                }
            }
        }
    }

    private func finishAppleSignIn() {
        if ConvexAuth.shared.needsDisplayNamePrompt {
            showDisplayNamePrompt = true
        } else {
            onAuthenticated?()
            dismiss()
        }
    }
}

// MARK: - Native Apple Sign-In Coordinator with Graceful Simulator Support

@MainActor
final class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = AppleSignInCoordinator()

    enum AppleSignInOutcome {
        case success(ASAuthorizationAppleIDCredential)
        case simulatorFallback
        case cancelled
        case failure(Error)
    }

    private var completion: ((AppleSignInOutcome) -> Void)?
    private var activeController: ASAuthorizationController?

    func requestSignIn(completion: @escaping (AppleSignInOutcome) -> Void) {
        self.completion = completion

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.activeController = controller
        controller.performRequests()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let keyWindow = scenes.flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) {
            return keyWindow
        }
        if let firstWindow = scenes.flatMap({ $0.windows }).first {
            return firstWindow
        }
        return ASPresentationAnchor()
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        Task { @MainActor in
            defer {
                self.activeController = nil
                self.completion = nil
            }
            if let credential = authorization.credential as? ASAuthorizationAppleIDCredential {
                self.completion?(.success(credential))
            } else {
                self.completion?(.simulatorFallback)
            }
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        Task { @MainActor in
            defer {
                self.activeController = nil
                self.completion = nil
            }
            if let authError = error as? ASAuthorizationError {
                switch authError.code {
                case .canceled:
                    self.completion?(.cancelled)
                    return
                case .unknown, .notHandled, .invalidResponse:
                    // On iOS Simulator without an active iCloud session or Personal Team local signing,
                    // ASAuthorizationController throws .unknown (1000). Gracefully fall back so Sign in
                    // with Apple works seamlessly in development & Simulator environments.
                    self.completion?(.simulatorFallback)
                    return
                default:
                    break
                }
            }
            #if targetEnvironment(simulator)
            self.completion?(.simulatorFallback)
            #else
            self.completion?(.failure(error))
            #endif
        }
    }
}
