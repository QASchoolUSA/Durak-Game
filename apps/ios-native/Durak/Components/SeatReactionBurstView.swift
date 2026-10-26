import SwiftUI

/// One-shot reaction burst anchored to a seat (opponent avatar or self dock).
struct SeatReactionBurstView: View {
    let token: String
    var size: CGFloat = 56

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ReactionBurstView(token: token, size: size, forceStatic: reduceMotion)
            .allowsHitTesting(false)
            .shadow(color: .black.opacity(0.35), radius: 8, y: 3)
            .transition(
                reduceMotion
                    ? .opacity
                    : .scale(scale: 0.55).combined(with: .opacity)
            )
    }
}

struct ActiveSeatReaction: Equatable {
    let token: String
    let fromPlayerId: String
    let id: TimeInterval
}
