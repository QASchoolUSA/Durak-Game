import SwiftUI

/// Central design tokens — one cohesive, professional look across the whole game.
///
/// Port of `apps/mobile/src/theme/index.ts`.
enum DesignTokens {

    // MARK: - Colors

    enum Colors {
        // ── Table felt ──────────────────────────────────────
        static let feltTop    = Color(hex: "#14724F")
        static let feltMid    = Color(hex: "#0F5A3C")
        static let feltBottom = Color(hex: "#092E1F")
        static let feltEdge   = Color(hex: "#061A12")

        // ── Gold ────────────────────────────────────────────
        static let gold       = Color(hex: "#E7C067")
        static let goldBright = Color(hex: "#F5D27A")
        static let goldDim    = Color(hex: "#9A7B36")
        static let goldDeep   = Color(hex: "#6B520E")

        // ── Cards ───────────────────────────────────────────
        static let cardFace     = Color(hex: "#FAF7F0")
        static let cardFaceEdge = Color(hex: "#DDD6C5")
        static let cardBack     = Color(hex: "#15324A")
        static let cardBackAccent = Color(hex: "#1E4D72")

        // ── Suits ───────────────────────────────────────────
        static let suitRed   = Color(hex: "#D7263D")
        static let suitBlack = Color(hex: "#20232A")

        // ── Status ──────────────────────────────────────────
        static let trumpGlow = Color(hex: "#F2D27A")
        static let success   = Color(hex: "#46A758")
        static let danger    = Color(hex: "#E5484D")

        // ── Semantic ────────────────────────────────────────
        static let win  = Color(hex: "#46A758")
        static let lose = Color(hex: "#E5484D")
        static let draw = Color(hex: "#B9C6BE")

        // ── Aliases & Extras ────────────────────────────────
        static let redCard   = Color(hex: "#D7263D")
        static let blackCard = Color(hex: "#20232A")
        static let goldLight = Color(hex: "#F5D27A")
        static let surfaceDark = Color(hex: "#092E1F")
        static let surfaceGlass = Color.black.opacity(0.45)

        // ── Text ────────────────────────────────────────────
        static let textLight = Color(hex: "#F5F3EC")
        static let textMuted = Color(hex: "#A8BAB2")
        static let textFaint = Color(hex: "#6B8078")
        static let textDark  = Color(hex: "#1B1B1F")

        // ── UI ──────────────────────────────────────────────
        static let overlay    = Color.black.opacity(0.80)
        static let overlayMid = Color.black.opacity(0.55)
        static let panel      = Color(hex: "#092E1F").opacity(0.75)
        static let panelLight = Color(hex: "#145037").opacity(0.55)
        static let separator  = Color(hex: "#E7C067").opacity(0.15)
    }

    // MARK: - Spacing

    enum Spacing {
        static let xxs: CGFloat = 2
        static let xs:  CGFloat = 4
        static let sm:  CGFloat = 8
        static let md:  CGFloat = 14
        static let lg:  CGFloat = 20
        static let xl:  CGFloat = 28
        static let xxl: CGFloat = 40
    }

    // MARK: - Corner Radii

    enum Radius {
        static let card:  CGFloat = 9
        static let panel: CGFloat = 20
        static let pill:  CGFloat = 999
        static let sm:    CGFloat = 6
    }

    // MARK: - Typography

    enum Typography {
        static let hero    = Font.system(size: 58, weight: .black)
        static let display = Font.system(size: 34, weight: .black)
        static let title   = Font.system(size: 22, weight: .heavy)
        static let heading = Font.system(size: 17, weight: .bold)
        static let button  = Font.system(size: 15, weight: .bold)
        static let body    = Font.system(size: 14, weight: .medium)
        static let caption = Font.system(size: 12, weight: .semibold)
        static let captionSmall = Font.system(size: 10, weight: .semibold)
        static let label   = Font.system(size: 9, weight: .heavy)
        static let micro   = Font.system(size: 8, weight: .bold)
    }

    // MARK: - Card

    static let cardAspect: CGFloat = 1.4
}

// MARK: - Color Extension

extension Color {
    /// Initialize from a hex string (e.g. "#14724F" or "14724F").
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: // RGB
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Apple Spring Pressable Button Style

struct SpringPressableButtonStyle: ButtonStyle {
    var scaleAmount: CGFloat = 0.95
    var hapticFeedback: FeedbackEvent = .uiTap

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scaleAmount : 1.0)
            .animation(.spring(response: 0.22, dampingFraction: 0.65), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, isPressed in
                if isPressed {
                    FeedbackManager.shared.trigger(hapticFeedback)
                }
            }
    }
}

extension ButtonStyle where Self == SpringPressableButtonStyle {
    static var springPressable: SpringPressableButtonStyle {
        SpringPressableButtonStyle()
    }

    static func springPressable(scale: CGFloat = 0.95, feedback: FeedbackEvent = .uiTap) -> SpringPressableButtonStyle {
        SpringPressableButtonStyle(scaleAmount: scale, hapticFeedback: feedback)
    }
}

// MARK: - Golden Shimmer Effect

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1.0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    let size = geo.size
                    LinearGradient(
                        colors: [
                            Color.clear,
                            Color.white.opacity(0.25),
                            Color.clear
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(width: size.width * 0.7, height: size.height)
                    .offset(x: phase * (size.width * 1.8))
                    .blendMode(.screen)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 2.8).repeatForever(autoreverses: false)) {
                    phase = 1.0
                }
            }
    }
}

extension View {
    func goldenShimmer() -> some View {
        modifier(ShimmerModifier())
    }
}
