import SwiftUI

/// Animated celebratory confetti burst.
struct ConfettiView: View {
    @State private var animate = false

    private let colors: [Color] = [
        DesignTokens.Colors.gold,
        Color.red,
        Color.blue,
        Color.green,
        Color.orange,
        Color.purple,
        Color.yellow
    ]

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(0..<45, id: \.self) { i in
                    ConfettiPiece(
                        color: colors[i % colors.count],
                        size: CGSize(width: CGFloat.random(in: 8...14), height: CGFloat.random(in: 12...20)),
                        startX: CGFloat.random(in: 0...geo.size.width),
                        endX: CGFloat.random(in: -50...geo.size.width + 50),
                        endY: geo.size.height + 60,
                        duration: Double.random(in: 2.2...3.8),
                        delay: Double.random(in: 0...0.8),
                        rotation: Double.random(in: 180...720),
                        animate: animate
                    )
                }
            }
        }
        .ignoresSafeArea()
        .onAppear {
            animate = true
        }
    }
}

private struct ConfettiPiece: View {
    let color: Color
    let size: CGSize
    let startX: CGFloat
    let endX: CGFloat
    let endY: CGFloat
    let duration: Double
    let delay: Double
    let rotation: Double
    let animate: Bool

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(width: size.width, height: size.height)
            .rotationEffect(.degrees(animate ? rotation : 0))
            .position(
                x: animate ? endX : startX,
                y: animate ? endY : -30
            )
            .animation(
                Animation.easeOut(duration: duration)
                    .delay(delay)
                    .repeatForever(autoreverses: false),
                value: animate
            )
    }
}
