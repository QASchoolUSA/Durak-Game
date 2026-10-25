/// Deck construction, shuffle, and deterministic PRNG.
///
/// 1:1 port of `packages/game-core/src/deck.ts`.

// MARK: - Constants

public let allSuits: [Suit] = [.spades, .hearts, .diamonds, .clubs]

/// 36-card deck: 6 through Ace.
public let allRanks: [Rank] = [.six, .seven, .eight, .nine, .ten, .jack, .queen, .king, .ace]

public let suitSymbols: [Suit: String] = [
    .spades: "\u{2660}",
    .hearts: "\u{2665}",
    .diamonds: "\u{2666}",
    .clubs: "\u{2663}",
]

public let rankLabels: [Rank: String] = [
    .six: "6",
    .seven: "7",
    .eight: "8",
    .nine: "9",
    .ten: "10",
    .jack: "J",
    .queen: "Q",
    .king: "K",
    .ace: "A",
]

public func isRed(_ suit: Suit) -> Bool {
    suit == .hearts || suit == .diamonds
}

public func cardId(rank: Rank, suit: Suit) -> String {
    "\(rank.rawValue)-\(suit.rawValue)"
}

// MARK: - Deck Construction

/// Builds an ordered 36-card deck.
public func buildDeck() -> [Card] {
    var cards: [Card] = []
    cards.reserveCapacity(36)
    for suit in allSuits {
        for rank in allRanks {
            cards.append(Card(suit: suit, rank: rank))
        }
    }
    return cards
}

// MARK: - Deterministic PRNG (Mulberry32)

/// Deterministic PRNG (mulberry32). A seed makes shuffles reproducible, which is
/// essential for unit tests and for a future server that needs to replay games.
///
/// Exact same algorithm as the TypeScript version so identical seeds produce
/// identical sequences.
public struct Mulberry32: Sendable {
    private var state: UInt32

    public init(seed: UInt32) {
        self.state = seed
    }

    /// Returns the next random float in [0, 1).
    public mutating func nextFloat() -> Double {
        state &+= 0x6D2B_79F5
        var t = UInt32(truncatingIfNeeded: Int64(state) &* Int64(1 | state ^ (state >> 15)))
        t = UInt32(truncatingIfNeeded: Int64(t) &+ Int64(truncatingIfNeeded: Int64(t ^ (t >> 7)) &* Int64(61 | t))) ^ t
        let result = (t ^ (t >> 14))
        return Double(result) / 4_294_967_296.0
    }
}

// MARK: - Shuffle

/// Returns a new, shuffled copy of the deck using Fisher-Yates.
public func shuffleDeck(_ deck: [Card], rng: inout Mulberry32) -> [Card] {
    var out = deck
    for i in stride(from: out.count - 1, through: 1, by: -1) {
        let j = Int(rng.nextFloat() * Double(i + 1))
        out.swapAt(i, j)
    }
    return out
}
