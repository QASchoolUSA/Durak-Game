/// Core domain types for Durak (Podkidnoy + Perevodnoy variants).
///
/// Everything here is plain, serializable data so the exact same engine can run
/// on the client (for instant UI feedback) and later on an authoritative server.
///
/// This is a 1:1 port of `packages/game-core/src/types.ts`.

// MARK: - Card Primitives

public enum Suit: String, Codable, CaseIterable, Sendable, Hashable {
    case spades, hearts, diamonds, clubs
}

/// Ranks are stored as their comparison value so beating logic is trivial:
/// 6..10 are themselves, J=11, Q=12, K=13, A=14.
public enum Rank: Int, Codable, CaseIterable, Comparable, Sendable, Hashable {
    case six = 6, seven = 7, eight = 8, nine = 9, ten = 10
    case jack = 11, queen = 12, king = 13, ace = 14

    public static func < (lhs: Rank, rhs: Rank) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

public struct Card: Identifiable, Equatable, Hashable, Codable, Sendable {
    public let suit: Suit
    public let rank: Rank
    public let id: String

    public init(suit: Suit, rank: Rank, id: String? = nil) {
        self.suit = suit
        self.rank = rank
        self.id = id ?? "\(rank.rawValue)-\(suit.rawValue)"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.suit = try container.decode(Suit.self, forKey: .suit)
        self.rank = try container.decode(Rank.self, forKey: .rank)
        self.id = try container.decodeIfPresent(String.self, forKey: .id) ?? "\(self.rank.rawValue)-\(self.suit.rawValue)"
    }
}

// MARK: - Player

public typealias PlayerId = String

// MARK: - Table

/// One attack card and (optionally) the card that has beaten it.
public struct TablePair: Equatable, Codable, Sendable {
    public var attack: Card
    public var defense: Card?
    /// True when this attack was added by a perevodnoy TRANSFER move.
    public var viaTransfer: Bool

    public init(attack: Card, defense: Card? = nil, viaTransfer: Bool = false) {
        self.attack = attack
        self.defense = defense
        self.viaTransfer = viaTransfer
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.attack = try container.decode(Card.self, forKey: .attack)
        self.defense = try container.decodeIfPresent(Card.self, forKey: .defense)
        self.viaTransfer = try container.decodeIfPresent(Bool.self, forKey: .viaTransfer) ?? false
    }
}

// MARK: - Game Configuration

public enum GamePhase: String, Codable, Sendable {
    case playing
    case gameOver
}

public enum GameVariant: String, Codable, Sendable {
    case podkidnoy
    case perevodnoy
}

/// Who may throw in matching ranks after the opening attack.
public enum ThrowInScope: String, Codable, Sendable {
    case all
    case neighbor
}

/// Standard rules vs human-only ability powers (client-enforced).
public enum PlayStyle: String, Codable, Sendable {
    case standard
    case abilities
}

public struct GameRules: Codable, Sendable, Equatable {
    public var variant: GameVariant
    public var throwInScope: ThrowInScope
    public var playStyle: PlayStyle

    public init(
        variant: GameVariant = .podkidnoy,
        throwInScope: ThrowInScope = .all,
        playStyle: PlayStyle = .standard
    ) {
        self.variant = variant
        self.throwInScope = throwInScope
        self.playStyle = playStyle
    }

    public static let `default` = GameRules()
}

// MARK: - Moves

/// Every move a player can submit. Throw-ins are just ATTACK on a non-empty table.
public enum Move: Sendable, Equatable {
    case attack(player: PlayerId, card: Card)
    case defend(player: PlayerId, card: Card, target: Int)
    case transfer(player: PlayerId, card: Card, target: Int)
    case take(player: PlayerId)
    case pass(player: PlayerId)

    public var player: PlayerId {
        switch self {
        case .attack(let p, _), .defend(let p, _, _), .transfer(let p, _, _),
             .take(let p), .pass(let p):
            return p
        }
    }
}

// MARK: - Game State

public struct GameState: Sendable, Equatable, Codable {
    /// Seating order around the table. Never mutated after creation.
    public let players: [PlayerId]
    public var hands: [PlayerId: [Card]]
    /// Draw pile. Index 0 is the next card to be drawn; the last entry is the trump (bottom) card.
    public var deck: [Card]
    public let trumpSuit: Suit
    /// The face-up card at the bottom of the deck that fixes the trump suit.
    public let trumpCard: Card

    public var table: [TablePair]
    /// "Bito" — cards that have been successfully beaten and are out of play.
    public var discard: [Card]

    public var attackerId: PlayerId
    public var defenderId: PlayerId

    /// True once the defender has declared they will take; attackers may still throw in.
    public var takeInProgress: Bool
    /// Attackers who have declared "done" this round.
    public var passed: [PlayerId]

    /// Players who have run out of cards (deck empty), in the order they got out.
    public var finishedOrder: [PlayerId]
    /// The "durak" (fool) — last player holding cards. nil while playing or on a draw.
    public var loserId: PlayerId?

    public var phase: GamePhase
    /// Max attacking cards allowed in a single round (5 for bout 1, then 6).
    public var maxAttacks: Int
    /// House rules fixed for this game.
    public let rules: GameRules

    public init(
        players: [PlayerId],
        hands: [PlayerId: [Card]],
        deck: [Card],
        trumpSuit: Suit,
        trumpCard: Card,
        table: [TablePair] = [],
        discard: [Card] = [],
        attackerId: PlayerId,
        defenderId: PlayerId,
        takeInProgress: Bool = false,
        passed: [PlayerId] = [],
        finishedOrder: [PlayerId] = [],
        loserId: PlayerId? = nil,
        phase: GamePhase = .playing,
        maxAttacks: Int = 5,
        rules: GameRules = .default
    ) {
        self.players = players
        self.hands = hands
        self.deck = deck
        self.trumpSuit = trumpSuit
        self.trumpCard = trumpCard
        self.table = table
        self.discard = discard
        self.attackerId = attackerId
        self.defenderId = defenderId
        self.takeInProgress = takeInProgress
        self.passed = passed
        self.finishedOrder = finishedOrder
        self.loserId = loserId
        self.phase = phase
        self.maxAttacks = maxAttacks
        self.rules = rules
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.players = try container.decode([PlayerId].self, forKey: .players)
        self.hands = try container.decode([PlayerId: [Card]].self, forKey: .hands)
        self.deck = try container.decode([Card].self, forKey: .deck)
        self.trumpSuit = try container.decode(Suit.self, forKey: .trumpSuit)
        self.trumpCard = try container.decode(Card.self, forKey: .trumpCard)
        self.table = try container.decodeIfPresent([TablePair].self, forKey: .table) ?? []
        self.discard = try container.decodeIfPresent([Card].self, forKey: .discard) ?? []
        self.attackerId = try container.decode(PlayerId.self, forKey: .attackerId)
        self.defenderId = try container.decode(PlayerId.self, forKey: .defenderId)
        self.takeInProgress = try container.decodeIfPresent(Bool.self, forKey: .takeInProgress) ?? false
        self.passed = try container.decodeIfPresent([PlayerId].self, forKey: .passed) ?? []
        self.finishedOrder = try container.decodeIfPresent([PlayerId].self, forKey: .finishedOrder) ?? []
        self.loserId = try container.decodeIfPresent(PlayerId.self, forKey: .loserId)
        self.phase = try container.decode(GamePhase.self, forKey: .phase)
        self.maxAttacks = try container.decodeIfPresent(Int.self, forKey: .maxAttacks) ?? 5
        self.rules = try container.decodeIfPresent(GameRules.self, forKey: .rules) ?? .default
    }
}
