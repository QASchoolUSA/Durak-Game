import SwiftUI

/// Animated countdown ring around active player seat with Apple-grade continuous trim and heartbeat pulse.
struct TurnTimerRing: View {
    @Environment(ThemeManager.self) private var theme
    let progress: Double // 1.0 -> 0.0
    let isWarning: Bool

    @State private var pulseScale: CGFloat = 1.0

    var ringColor: Color {
        if progress < 0.25 || isWarning {
            return Color.red
        } else if progress < 0.5 {
            return Color.orange
        } else {
            return theme.ui.accent
        }
    }

    var body: some View {
        ZStack {
            // Background track
            Circle()
                .stroke(ringColor.opacity(0.18), lineWidth: 3)

            // Animated progress ring
            Circle()
                .trim(from: 0, to: CGFloat(max(0, min(1, progress))))
                .stroke(ringColor, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: ringColor.opacity((isWarning || progress < 0.25) ? 0.6 : 0.2), radius: (isWarning || progress < 0.25) ? 6 : 2)
                .animation(.linear(duration: 0.1), value: progress)
        }
        .scaleEffect(pulseScale)
        .onChange(of: isWarning) { _, warning in
            if warning {
                withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                    pulseScale = 1.07
                }
            } else {
                withAnimation(.easeOut(duration: 0.25)) {
                    pulseScale = 1.0
                }
            }
        }
        .onAppear {
            if isWarning {
                withAnimation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true)) {
                    pulseScale = 1.07
                }
            }
        }
    }
}
