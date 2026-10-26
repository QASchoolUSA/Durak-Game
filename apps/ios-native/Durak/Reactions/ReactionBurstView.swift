import SwiftUI
import Lottie

/// Shared fraction of the outer tile/burst used for the drawable glyph (uniform sizing).
private let reactionGlyphFill: CGFloat = 0.78

/// Renders a reaction token as Unicode text or Noto Lottie (table burst).
struct ReactionBurstView: View {
    let token: String
    var size: CGFloat = 72
    var forceStatic: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var contentSize: CGFloat { size * reactionGlyphFill }

    var body: some View {
        ZStack {
            if let sticker = ReactionCatalog.sticker(for: token) {
                content(for: sticker)
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipped()
        .accessibilityLabel(ReactionCatalog.sticker(for: token)?.accessibilityLabel ?? String(localized: "Reaction"))
    }

    @ViewBuilder
    private func content(for sticker: ReactionSticker) -> some View {
        switch sticker.kind {
        case .unicode:
            uniformUnicode(sticker.unicodeGlyph ?? sticker.token, box: contentSize)
        case .lottie:
            if forceStatic || reduceMotion {
                uniformUnicode(sticker.unicodeGlyph ?? "🙂", box: contentSize)
            } else if let name = sticker.lottieName {
                NotoLottieView(
                    name: name,
                    loopMode: .playOnce,
                    play: true,
                    allowLoad: true
                )
                .frame(width: contentSize, height: contentSize)
                .clipped()
            } else {
                fallback
            }
        }
    }

    private var fallback: some View {
        Image(systemName: "face.smiling")
            .font(.system(size: contentSize * 0.55, weight: .semibold))
            .foregroundStyle(DesignTokens.Colors.textMuted)
            .symbolRenderingMode(.hierarchical)
            .frame(width: contentSize, height: contentSize)
            .clipped()
    }
}

/// Unicode glyph locked to a square so different codepoints share the same visual box.
private func uniformUnicode(_ glyph: String, box: CGFloat) -> some View {
    Text(glyph)
        .font(.system(size: box * 0.92))
        .minimumScaleFactor(0.5)
        .lineLimit(1)
        .multilineTextAlignment(.center)
        .frame(width: box, height: box)
        .clipped()
}

// MARK: - Cache

/// Load-once cache for Noto Lottie JSON (warmed on GameView; used by in-game burst).
enum NotoLottieCache {
    private static let lock = NSLock()
    private static var animations: [String: LottieAnimation] = [:]

    /// Hit-only — never loads or blocks the main thread.
    static func cached(named name: String) -> LottieAnimation? {
        lock.lock()
        defer { lock.unlock() }
        return animations[name]
    }

    static func isCached(named name: String) -> Bool {
        cached(named: name) != nil
    }

    /// Burst path: return cache or load once (single animation — acceptable).
    static func animation(named name: String) -> LottieAnimation? {
        if let hit = cached(named: name) { return hit }
        let loaded = loadFromBundle(name)
        guard let loaded else { return nil }
        lock.lock()
        animations[name] = loaded
        lock.unlock()
        return loaded
    }

    /// Prefetch catalog Lotties off the main actor (GameView appear).
    static func warmAll() {
        let names = ReactionCatalog.allLottieNames
        Task.detached(priority: .utility) {
            for name in names {
                if cached(named: name) != nil { continue }
                guard let loaded = loadFromBundle(name) else { continue }
                lock.lock()
                animations[name] = loaded
                lock.unlock()
            }
        }
    }

    private static func loadFromBundle(_ name: String) -> LottieAnimation? {
        LottieAnimation.named(name, bundle: .main, subdirectory: "NotoReactions")
            ?? LottieAnimation.named(name, bundle: .main)
            ?? Bundle.main.url(forResource: name, withExtension: "json", subdirectory: "NotoReactions")
                .flatMap { LottieAnimation.filepath($0.path) }
            ?? Bundle.main.url(forResource: name, withExtension: "json")
                .flatMap { LottieAnimation.filepath($0.path) }
    }
}

// MARK: - Lottie view

private let notoLottieConfiguration = LottieConfiguration(renderingEngine: .coreAnimation)

/// Host that pins Lottie to a SwiftUI-owned square (clips uneven Noto compositions).
final class NotoLottieHostView: UIView {
    let animationView: LottieAnimationView

    override init(frame: CGRect) {
        animationView = LottieAnimationView(configuration: notoLottieConfiguration)
        super.init(frame: frame)
        clipsToBounds = true
        isUserInteractionEnabled = false
        animationView.contentMode = .scaleAspectFit
        animationView.backgroundBehavior = .pauseAndRestore
        animationView.isUserInteractionEnabled = false
        animationView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(animationView)
        NSLayoutConstraint.activate([
            animationView.leadingAnchor.constraint(equalTo: leadingAnchor),
            animationView.trailingAnchor.constraint(equalTo: trailingAnchor),
            animationView.topAnchor.constraint(equalTo: topAnchor),
            animationView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        setContentHuggingPriority(.defaultLow, for: .horizontal)
        setContentHuggingPriority(.defaultLow, for: .vertical)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var intrinsicContentSize: CGSize { CGSize(width: UIView.noIntrinsicMetric, height: UIView.noIntrinsicMetric) }
}

/// Core Animation–backed Lottie host for bursts and (budgeted) picker cells.
struct NotoLottieView: UIViewRepresentable {
    let name: String
    var loopMode: LottieLoopMode = .playOnce
    var play: Bool = true
    /// When false (picker), only use pre-warmed cache — never decode on main.
    var allowLoad: Bool = false

    func makeUIView(context: Context) -> NotoLottieHostView {
        let host = NotoLottieHostView()
        configure(host.animationView)
        return host
    }

    func updateUIView(_ uiView: NotoLottieHostView, context: Context) {
        if context.coordinator.loadedName != name {
            configure(uiView.animationView)
            context.coordinator.loadedName = name
        }
        applyPlayback(uiView.animationView)
    }

    private func configure(_ view: LottieAnimationView) {
        if allowLoad {
            view.animation = NotoLottieCache.animation(named: name)
        } else {
            view.animation = NotoLottieCache.cached(named: name)
        }
        view.loopMode = loopMode
        applyPlayback(view)
    }

    private func applyPlayback(_ view: LottieAnimationView) {
        view.loopMode = loopMode
        if !play || view.animation == nil {
            view.pause()
            view.currentProgress = 0
        } else if !view.isAnimationPlaying {
            view.play()
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var loadedName: String?
    }
}

// MARK: - Picker cell

private let pickerTileSize: CGFloat = 52
private let pickerContentSize: CGFloat = 52 * 0.78

/// Drawer cell: static Unicode only; Lottie plays in-game via `ReactionBurstView`.
struct NotoPickerCell: View {
    let sticker: ReactionSticker
    @Environment(ThemeManager.self) private var theme

    var body: some View {
        uniformUnicode(sticker.unicodeGlyph ?? "🙂", box: pickerContentSize)
            .frame(width: pickerTileSize, height: pickerTileSize)
            .clipped()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(theme.ui.surfaceGlass)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
            )
            .accessibilityLabel(sticker.accessibilityLabel)
    }
}
