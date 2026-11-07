import Testing
@testable import DurakGameCore

// MARK: - Helpers

func makeCard(_ rank: Rank, _ suit: Suit) -> Card {
    Card(suit: suit, rank: rank)
}

func countAllCards(_ s: GameState) -> Int {
    var n = s.deck.count + s.discard.count
    for p in s.players { n += (s.hands[p] ?? []).count }
    for pair in s.table { n += 1 + (pair.defense != nil ? 1 : 0) }
    return n
}

/// Minimal hand-built state for deterministic rule tests.
func baseState(
    players: [PlayerId] = ["A", "B"],
    hands: [PlayerId: [Card]] = ["A": [], "B": []],
    deck: [Card] = [],
    trumpSuit: Suit = .spades,
    table: [TablePair] = [],
    discard: [Card] = [],
    attackerId: PlayerId = "A",
    defenderId: PlayerId = "B",
    takeInProgress: Bool = false,
    passed: [PlayerId] = [],
    finishedOrder: [PlayerId] = [],
    loserId: PlayerId? = nil,
    phase: GamePhase = .playing,
    maxAttacks: Int = 6,
    rules: GameRules = .default
) -> GameState {
    GameState(
        players: players,
        hands: hands,
        deck: deck,
        trumpSuit: trumpSuit,
        trumpCard: makeCard(.six, trumpSuit),
        table: table,
        discard: discard,
        attackerId: attackerId,
        defenderId: defenderId,
        takeInProgress: takeInProgress,
        passed: passed,
        finishedOrder: finishedOrder,
        loserId: loserId,
        phase: phase,
        maxAttacks: maxAttacks,
        rules: rules
    )
}

// MARK: - Deck Tests

@Suite("Deck")
struct DeckTests {
    @Test("builds 36 unique cards")
    func buildDeck36() {
        let deck = buildDeck()
        #expect(deck.count == 36)
        #expect(Set(deck.map(\.id)).count == 36)
    }

    @Test("shuffles deterministically for a given seed and preserves the multiset")
    func deterministicShuffle() {
        var rngA = Mulberry32(seed: 123)
        var rngB = Mulberry32(seed: 123)
        var rngC = Mulberry32(seed: 999)
        let a = shuffleDeck(buildDeck(), rng: &rngA)
        let b = shuffleDeck(buildDeck(), rng: &rngB)
        let c = shuffleDeck(buildDeck(), rng: &rngC)
        #expect(a.map(\.id) == b.map(\.id))
        #expect(a.map(\.id) != c.map(\.id))
        #expect(Set(a.map(\.id)).count == 36)
    }
}

// MARK: - Beats Tests

@Suite("Beats")
struct BeatsTests {
    @Test("higher rank of same suit wins")
    func samesuit() {
        #expect(beats(makeCard(.ten, .hearts), makeCard(.seven, .hearts), trumpSuit: .spades) == true)
        #expect(beats(makeCard(.seven, .hearts), makeCard(.ten, .hearts), trumpSuit: .spades) == false)
    }

    @Test("trump beats non-trump")
    func trumpBeatsNon() {
        #expect(beats(makeCard(.six, .spades), makeCard(.ace, .hearts), trumpSuit: .spades) == true)
    }

    @Test("non-trump cannot beat trump")
    func nonTrumpFails() {
        #expect(beats(makeCard(.ace, .hearts), makeCard(.six, .spades), trumpSuit: .spades) == false)
    }

    @Test("higher trump beats lower trump")
    func trumpVsTrump() {
        #expect(beats(makeCard(.nine, .spades), makeCard(.seven, .spades), trumpSuit: .spades) == true)
    }

    @Test("different non-trump suits never beat")
    func differentSuits() {
        #expect(beats(makeCard(.ace, .hearts), makeCard(.six, .clubs), trumpSuit: .spades) == false)
    }
}

// MARK: - CreateGame Tests

@Suite("createGame")
struct CreateGameTests {
    @Test("deals 6 cards each and fixes the trump")
    func basicDeal() {
        let g = createGame(playerIds: ["A", "B", "C"], options: CreateGameOptions(seed: 42))
        #expect(g.players.count == 3)
        for p in g.players {
            #expect((g.hands[p] ?? []).count == 6)
        }
        #expect(g.deck.count == 36 - 18)
        #expect(g.trumpCard.suit == g.trumpSuit)
        #expect(countAllCards(g) == 36)
    }

    @Test("deals 6 cards each with an empty deck for 6 players")
    func sixPlayers() {
        let g = createGame(playerIds: ["A", "B", "C", "D", "E", "F"], options: CreateGameOptions(seed: 42))
        #expect(g.players.count == 6)
        for p in g.players {
            #expect((g.hands[p] ?? []).count == 6)
        }
        #expect(g.deck.count == 0)
        #expect(countAllCards(g) == 36)
    }

    @Test("first attacker holds the lowest trump when one exists")
    func lowestTrumpAttacks() {
        let g = createGame(playerIds: ["A", "B", "C", "D"], options: CreateGameOptions(seed: 7))
        var lowestRank = Int.max
        var owner: PlayerId? = nil
        for p in g.players {
            for c in g.hands[p] ?? [] {
                if c.suit == g.trumpSuit && c.rank.rawValue < lowestRank {
                    lowestRank = c.rank.rawValue
                    owner = p
                }
            }
        }
        if let owner { #expect(g.attackerId == owner) }
    }

    @Test("starts first bout with a 5-card attack cap")
    func fiveCardCap() {
        let g = createGame(playerIds: ["A", "B"], options: CreateGameOptions(seed: 42))
        #expect(g.maxAttacks == 5)
    }
}

// MARK: - Attack / Throw-in Limits

@Suite("Attack / Throw-in Limits")
struct AttackLimitTests {
    @Test("only the attacker can open, with any card")
    func onlyAttacker() {
        let s = baseState(hands: [
            "A": [makeCard(.six, .hearts), makeCard(.nine, .clubs)],
            "B": [makeCard(.ten, .hearts)],
        ])
        #expect(legalAttacks(s, "A").count == 2)
        #expect(legalAttacks(s, "B").count == 0)
    }

    @Test("throw-ins must match a rank already on the table")
    func matchingRank() {
        let s = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .clubs), makeCard(.seven, .diamonds)],
                "B": [makeCard(.ten, .hearts), makeCard(.king, .spades)],
                "C": [],
            ],
            table: [TablePair(attack: makeCard(.nine, .hearts))],
            attackerId: "A",
            defenderId: "B"
        )
        let legal = legalAttacks(s, "A").map(\.id)
        #expect(legal.contains(cardId(rank: .nine, suit: .clubs)))
        #expect(!legal.contains(cardId(rank: .seven, suit: .diamonds)))
    }

    @Test("cannot pile more undefended attacks than the defender can answer")
    func defenderCapacity() {
        let s = baseState(hands: [
            "A": [makeCard(.nine, .clubs), makeCard(.nine, .diamonds)],
            "B": [makeCard(.ten, .hearts)],
        ], table: [TablePair(attack: makeCard(.nine, .hearts))])
        #expect(legalAttacks(s, "A").count == 0)
    }

    @Test("blocks throw-in after own PASS until another attacker throws")
    func blockThrowAfterOwnPass() throws {
        var s = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .clubs)],
                "B": [makeCard(.ten, .hearts), makeCard(.seven, .spades)],
                "C": [makeCard(.nine, .diamonds)],
            ],
            table: [TablePair(attack: makeCard(.nine, .hearts), defense: makeCard(.ten, .clubs))],
            attackerId: "A",
            defenderId: "B"
        )
        s = try applyMove(s, .pass(player: "A"))
        #expect(s.passed.contains("A"))
        #expect(legalAttacks(s, "A").isEmpty)
        #expect(!canPass(s, "A"))

        s = try applyMove(s, .attack(player: "C", card: makeCard(.nine, .diamonds)))
        #expect(s.passed.isEmpty)
        #expect(legalAttacks(s, "A").map(\.id).contains(cardId(rank: .nine, suit: .clubs)))
    }

    @Test("allows mid-defense throw-in when defender has spare capacity")
    func spareCapacityMidDefense() {
        let s = baseState(
            hands: [
                "A": [makeCard(.nine, .clubs), makeCard(.seven, .diamonds)],
                "B": [makeCard(.ten, .hearts), makeCard(.jack, .hearts), makeCard(.queen, .hearts)],
            ],
            table: [TablePair(attack: makeCard(.nine, .hearts))]
        )
        let legal = legalAttacks(s, "A").map(\.id)
        #expect(legal == [cardId(rank: .nine, suit: .clubs)])
    }

    @Test("allows throw-in during take when defender has spare capacity")
    func spareCapacityDuringTake() {
        let s = baseState(
            hands: [
                "A": [makeCard(.nine, .clubs)],
                "B": [makeCard(.eight, .hearts), makeCard(.ten, .hearts), makeCard(.jack, .hearts)],
            ],
            table: [TablePair(attack: makeCard(.nine, .hearts))],
            takeInProgress: true
        )
        #expect(legalAttacks(s, "A").map(\.id) == [cardId(rank: .nine, suit: .clubs)])
    }

    @Test("raises attack cap to 6 after the first bout ends in a take")
    func raisesCapAfterFirstTake() throws {
        var s = baseState(
            hands: [
                "A": [makeCard(.nine, .hearts), makeCard(.six, .diamonds)],
                "B": [makeCard(.six, .clubs), makeCard(.seven, .clubs)],
            ],
            deck: [
                makeCard(.six, .spades),
                makeCard(.seven, .spades),
                makeCard(.eight, .spades),
                makeCard(.nine, .spades),
                makeCard(.ten, .spades),
                makeCard(.jack, .spades),
            ],
            maxAttacks: 5
        )
        s = try applyMove(s, .attack(player: "A", card: makeCard(.nine, .hearts)))
        s = try applyMove(s, .take(player: "B"))
        s = try applyMove(s, .pass(player: "A"))
        #expect(s.discard.isEmpty)
        #expect(s.maxAttacks == 6)
    }
}

// MARK: - Basic Game Flow

@Suite("Basic Game Flow")
struct GameFlowTests {
    @Test("successful defense discards and advances")
    func successfulDefense() throws {
        var s = baseState(hands: [
            "A": [makeCard(.six, .hearts)],
            "B": [makeCard(.ten, .hearts)],
        ])
        s = try applyMove(s, .attack(player: "A", card: makeCard(.six, .hearts)))
        #expect(s.table.count == 1)
        s = try applyMove(s, .defend(player: "B", card: makeCard(.ten, .hearts), target: 0))
        // Both hands now empty, deck empty → game over (draw).
        #expect(s.phase == .gameOver)
        #expect(s.loserId == nil)
    }

    @Test("take collects all table cards")
    func takeCollects() throws {
        var s = baseState(hands: [
            "A": [makeCard(.six, .hearts), makeCard(.six, .clubs)],
            "B": [makeCard(.seven, .diamonds)],
        ], deck: [makeCard(.eight, .clubs)])
        s = try applyMove(s, .attack(player: "A", card: makeCard(.six, .hearts)))
        s = try applyMove(s, .take(player: "B"))
        s = try applyMove(s, .pass(player: "A"))
        // Defender should have original card + the 6 of hearts from the table.
        let bHand = s.hands["B"] ?? []
        #expect(bHand.count >= 2)
    }

    @Test("2p last throw-in during take completes bout (no deadlock)")
    func lastThrowInDuringTake2p() throws {
        // Defender must hold ≥2 cards so one throw-in is legal (capacity rule).
        var s = baseState(
            hands: [
                "A": [makeCard(.six, .clubs)],
                "B": [makeCard(.seven, .diamonds), makeCard(.eight, .diamonds)],
            ],
            deck: [],
            table: [TablePair(attack: makeCard(.six, .hearts))],
            takeInProgress: true
        )
        #expect(legalAttacks(s, "A").count == 1)
        s = try applyMove(s, .attack(player: "A", card: makeCard(.six, .clubs)))
        #expect(s.takeInProgress == false)
        #expect(s.table.isEmpty)
        // Defender collected both attacks; attacker finished; B is sole holder → loser.
        #expect(s.phase == .gameOver)
        #expect(s.loserId == "B")
    }

    @Test("3p last co-attacker throw-in during take completes bout")
    func lastThrowInDuringTake3p() throws {
        var s = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [],
                "B": [makeCard(.seven, .diamonds), makeCard(.eight, .diamonds)],
                "C": [makeCard(.six, .clubs)],
            ],
            deck: [],
            table: [TablePair(attack: makeCard(.six, .hearts))],
            attackerId: "A",
            defenderId: "B",
            takeInProgress: true,
            finishedOrder: ["A"]
        )
        #expect(legalAttacks(s, "C").count == 1)
        s = try applyMove(s, .attack(player: "C", card: makeCard(.six, .clubs)))
        #expect(s.takeInProgress == false)
        #expect(s.table.isEmpty)
        // B collected table cards (or game already over with B as loser).
        if s.phase == .playing {
            let bHand = s.hands["B"] ?? []
            #expect(bHand.map(\.id).contains(makeCard(.six, .hearts).id))
            #expect(bHand.map(\.id).contains(makeCard(.six, .clubs).id))
        } else {
            #expect(s.phase == .gameOver)
        }
    }

    @Test("card conservation across full seeded game")
    func cardConservation() throws {
        var s = createGame(playerIds: ["A", "B"], options: CreateGameOptions(seed: 42))
        var moves = 0
        while s.phase == .playing && moves < 500 {
            for p in s.players {
                if let move = pickMove(s, p, difficulty: .medium) {
                    s = try applyMove(s, move)
                    #expect(countAllCards(s) == 36, "Card count mismatch after move \(moves)")
                    moves += 1
                    break
                }
            }
        }
        #expect(s.phase == .gameOver)
        #expect(countAllCards(s) == 36)
    }
}

// MARK: - AI Tests

@Suite("AI")
struct AITests {
    @Test("pickMove returns nil for a finished game")
    func finishedGame() {
        let s = baseState(phase: .gameOver)
        #expect(pickMove(s, "A") == nil)
    }

    @Test("pickMove returns a valid move for the attacker")
    func attackerMove() {
        let s = baseState(hands: [
            "A": [makeCard(.six, .hearts), makeCard(.nine, .clubs)],
            "B": [makeCard(.ten, .hearts), makeCard(.jack, .hearts)],
        ])
        let move = pickMove(s, "A", difficulty: .medium)
        #expect(move != nil)
        if case .attack(let p, _) = move {
            #expect(p == "A")
        }
    }

    @Test("AI can complete a full 2-player game without errors")
    func fullGame() throws {
        var s = createGame(playerIds: ["A", "B"], options: CreateGameOptions(seed: 777))
        var moves = 0
        while s.phase == .playing && moves < 500 {
            var acted = false
            for p in s.players {
                if let move = pickMove(s, p, difficulty: .hard) {
                    s = try applyMove(s, move)
                    acted = true
                    moves += 1
                    break
                }
            }
            if !acted { break }
        }
        #expect(s.phase == .gameOver)
    }

    @Test("AI completes games at all difficulty levels")
    func allDifficulties() throws {
        for diff in AiDifficulty.allCases {
            var s = createGame(playerIds: ["A", "B", "C"], options: CreateGameOptions(seed: 99))
            var moves = 0
            while s.phase == .playing && moves < 500 {
                var acted = false
                for p in s.players {
                    if let move = pickMove(s, p, difficulty: diff) {
                        s = try applyMove(s, move)
                        acted = true
                        moves += 1
                        break
                    }
                }
                if !acted { break }
            }
            #expect(s.phase == .gameOver, "Game didn't end for difficulty \(diff)")
        }
    }
}

// MARK: - Forfeit Tests

@Suite("Forfeit")
struct ForfeitTests {
    @Test("forceForfeitEnd marks the forfeiter as loser")
    func forfeit() {
        let s = createGame(playerIds: ["A", "B"], options: CreateGameOptions(seed: 42))
        let result = forceForfeitEnd(s, forfeiterId: "A")
        #expect(result.phase == .gameOver)
        #expect(result.loserId == "A")
    }
}

// MARK: - Timeout Move Tests

@Suite("Timeout Move")
struct TimeoutMoveTests {
    @Test("defender times out to TAKE")
    func defenderTake() {
        let s = baseState(hands: [
            "A": [makeCard(.nine, .clubs)],
            "B": [makeCard(.seven, .diamonds)],
        ], table: [TablePair(attack: makeCard(.six, .hearts))])
        let move = timeoutMoveFor(s, "B")
        if case .take(let p) = move {
            #expect(p == "B")
        } else {
            Issue.record("Expected .take move for defender")
        }
    }

    @Test("attacker with no table times out to lowest ATTACK")
    func attackerOpening() {
        let s = baseState(hands: [
            "A": [makeCard(.nine, .clubs), makeCard(.six, .hearts)],
            "B": [makeCard(.ten, .hearts), makeCard(.jack, .hearts)],
        ])
        let move = timeoutMoveFor(s, "A")
        if case .attack(_, let card) = move {
            #expect(card.rank == .six)
        } else {
            Issue.record("Expected .attack move for opening attacker")
        }
    }
}

// MARK: - Turn Timer Tests

@Suite("Turn Timer")
struct TurnTimerTests {
    @Test("normalizeTurnSeconds returns default for nil")
    func normalizeNil() {
        #expect(normalizeTurnSeconds(nil) == 12)
    }

    @Test("normalizeTurnSeconds returns valid values as-is")
    func normalizeValid() {
        #expect(normalizeTurnSeconds(10) == 10)
        #expect(normalizeTurnSeconds(15) == 15)
        #expect(normalizeTurnSeconds(30) == 30)
    }

    @Test("normalizeTurnSeconds falls back for invalid values")
    func normalizeInvalid() {
        #expect(normalizeTurnSeconds(60) == 12)
        #expect(normalizeTurnSeconds(0) == 12)
    }
}

// MARK: - Match Economy Tests

@Suite("Match Economy")
struct MatchEconomyTests {
    @Test("pot calculation")
    func potCalc() {
        #expect(matchPot(numPlayers: 2) == 200)
        #expect(matchPot(numPlayers: 4) == 400)
        #expect(matchPot(numPlayers: 6, buyIn: 50) == 300)
    }

    @Test("solo end credit delta")
    func soloEndDelta() {
        #expect(soloMatchEndCreditDelta(isDraw: true, humanIsWinner: false, numPlayers: 4) == 100)
        #expect(soloMatchEndCreditDelta(isDraw: false, humanIsWinner: true, numPlayers: 3) == 300)
        #expect(soloMatchEndCreditDelta(isDraw: false, humanIsWinner: false, numPlayers: 3) == 0)
    }
}

// MARK: - Parity with the TypeScript engine

private let perevodnoy = GameRules(
    variant: .perevodnoy,
    throwInScope: .all,
    playStyle: .standard,
    allowTransferOnFirstBout: true
)

@Suite("Perevodnoy transfer")
struct TransferTests {
    @Test("rotates the defender and keeps the transfer card as an attack")
    func transferChain() throws {
        var state = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .hearts)],
                "B": [makeCard(.nine, .diamonds), makeCard(.seven, .clubs)],
                "C": [makeCard(.ten, .hearts), makeCard(.eight, .clubs)],
            ],
            table: [TablePair(attack: makeCard(.nine, .clubs))],
            rules: perevodnoy
        )
        #expect(canTransfer(state, "B"))
        state = try applyMove(state, .transfer(player: "B", card: makeCard(.nine, .diamonds), target: 0))
        #expect(state.defenderId == "C")
        #expect(state.attackerId == "A")
        #expect(state.table.count == 2)
        #expect(state.table[1].attack.id == "9-diamonds")
        #expect(state.table[1].defense == nil)
        #expect(state.table[1].viaTransfer)
        #expect(state.passed.isEmpty)
    }

    @Test("blocks a transfer on the first bout unless the house rule allows it")
    func firstBoutBlocked() {
        let state = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .hearts)],
                "B": [makeCard(.nine, .diamonds), makeCard(.seven, .clubs)],
                "C": [makeCard(.ten, .hearts), makeCard(.eight, .clubs)],
            ],
            table: [TablePair(attack: makeCard(.nine, .clubs))],
            rules: GameRules(variant: .perevodnoy, allowTransferOnFirstBout: false)
        )
        #expect(!canTransfer(state, "B"))
        #expect(legalTransfers(state, target: 0).isEmpty)
    }

    @Test("rejects a transfer when every other seat is empty")
    func noSelfTransfer() {
        let state = baseState(
            players: ["A", "B"],
            hands: [
                "A": [],
                "B": [
                    makeCard(.nine, .diamonds),
                    makeCard(.seven, .clubs),
                    makeCard(.eight, .hearts),
                ],
            ],
            table: [TablePair(attack: makeCard(.nine, .clubs))],
            discard: [makeCard(.six, .hearts), makeCard(.seven, .hearts)],
            attackerId: "A",
            defenderId: "B",
            rules: GameRules(variant: .perevodnoy, allowTransferOnFirstBout: false)
        )
        #expect(!canTransfer(state, "B"))
        #expect(legalTransfers(state, target: 0).isEmpty)
    }

    @Test("allows a transfer after the first discard when the first bout is closed")
    func transferAfterFirstDiscard() {
        let state = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .hearts)],
                "B": [makeCard(.nine, .diamonds), makeCard(.seven, .clubs)],
                "C": [makeCard(.ten, .hearts), makeCard(.eight, .clubs)],
            ],
            table: [TablePair(attack: makeCard(.nine, .clubs))],
            discard: [makeCard(.six, .hearts), makeCard(.seven, .hearts)],
            rules: GameRules(variant: .perevodnoy, allowTransferOnFirstBout: false)
        )
        #expect(canTransfer(state, "B"))
    }

    @Test("a defense closes the transfer window")
    func defenseClosesWindow() {
        let state = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .hearts)],
                "B": [makeCard(.nine, .diamonds), makeCard(.ten, .clubs)],
                "C": [makeCard(.ten, .hearts), makeCard(.eight, .clubs)],
            ],
            table: [TablePair(attack: makeCard(.nine, .clubs), defense: makeCard(.ten, .clubs))],
            rules: perevodnoy
        )
        #expect(!canTransfer(state, "B"))
    }

    @Test("blocks a transfer the next player cannot cover")
    func nextDefenderCapacity() {
        let state = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .hearts)],
                "B": [makeCard(.nine, .diamonds)],
                "C": [makeCard(.ten, .hearts)],
            ],
            table: [TablePair(attack: makeCard(.nine, .clubs))],
            rules: perevodnoy
        )
        #expect(legalTransfers(state, target: 0).isEmpty)
    }

    @Test("blocks a transfer once the table is at the attack cap")
    func maxAttacks() {
        let state = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.seven, .hearts)],
                "B": [makeCard(.nine, .hearts)],
                "C": [makeCard(.ten, .hearts), makeCard(.jack, .hearts), makeCard(.queen, .hearts)],
            ],
            table: [
                TablePair(attack: makeCard(.nine, .clubs)),
                TablePair(attack: makeCard(.nine, .diamonds), viaTransfer: true),
                TablePair(attack: makeCard(.nine, .spades), viaTransfer: true),
            ],
            maxAttacks: 3,
            rules: perevodnoy
        )
        #expect(legalTransfers(state, target: 0).isEmpty)
    }

    @Test("only the opening attack can be the transfer target")
    func openingIndexOnly() {
        let state = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .hearts), makeCard(.seven, .hearts), makeCard(.eight, .hearts)],
                "B": [makeCard(.ten, .clubs)],
                "C": [makeCard(.nine, .spades), makeCard(.eight, .clubs)],
            ],
            table: [
                TablePair(attack: makeCard(.nine, .clubs)),
                TablePair(attack: makeCard(.nine, .diamonds), viaTransfer: true),
            ],
            defenderId: "C",
            rules: perevodnoy
        )
        #expect(!legalTransfers(state, target: 0).isEmpty)
        #expect(legalTransfers(state, target: 1).isEmpty)
    }

    @Test("podkidnoy has no transfer")
    func podkidnoy() {
        let state = baseState(
            players: ["A", "B", "C"],
            hands: [
                "A": [makeCard(.nine, .hearts)],
                "B": [makeCard(.nine, .diamonds), makeCard(.seven, .clubs)],
                "C": [makeCard(.ten, .hearts), makeCard(.eight, .clubs)],
            ],
            table: [TablePair(attack: makeCard(.nine, .clubs))],
            rules: .default
        )
        #expect(legalTransfers(state, target: 0).isEmpty)
    }
}

@Suite("Throw-in scope")
struct ThrowInScopeTests {
    @Test("neighbor scope limits throw-ins to the seats beside the defender")
    func neighborsOnly() {
        let state = baseState(
            players: ["A", "B", "C", "D"],
            hands: [
                "A": [makeCard(.nine, .clubs)],
                "B": [makeCard(.ten, .diamonds), makeCard(.eight, .hearts)],
                "C": [makeCard(.nine, .diamonds)],
                "D": [makeCard(.nine, .spades)],
            ],
            table: [TablePair(attack: makeCard(.nine, .hearts))],
            rules: GameRules(variant: .podkidnoy, throwInScope: .neighbor)
        )
        #expect(legalAttacks(state, "A").contains { $0.id == "9-clubs" })
        #expect(legalAttacks(state, "C").contains { $0.id == "9-diamonds" })
        #expect(legalAttacks(state, "D").isEmpty)
    }
}

@Suite("Draw-up and endgame")
struct EndgameParityTests {
    @Test("drawUpOrder lists the attacker first and the defender last")
    func drawOrder() {
        let state = baseState(
            players: ["A", "B", "C"],
            attackerId: "B",
            defenderId: "C"
        )
        #expect(drawUpOrder(state) == ["B", "A", "C"])
    }

    @Test("both players emptying on the last defense is a draw")
    func draw() throws {
        var state = baseState(hands: [
            "A": [makeCard(.nine, .hearts)],
            "B": [makeCard(.ten, .hearts)],
        ])
        state = try applyMove(state, .attack(player: "A", card: makeCard(.nine, .hearts)))
        state = try applyMove(state, .defend(player: "B", card: makeCard(.ten, .hearts), target: 0))
        #expect(state.phase == .gameOver)
        #expect(state.loserId == nil)
    }

    @Test("the player left holding cards is the durak")
    func durak() throws {
        var state = baseState(hands: [
            "A": [makeCard(.nine, .hearts)],
            "B": [makeCard(.seven, .hearts), makeCard(.eight, .clubs)],
        ])
        state = try applyMove(state, .attack(player: "A", card: makeCard(.nine, .hearts)))
        state = try applyMove(state, .take(player: "B"))
        #expect(state.phase == .gameOver)
        #expect(state.loserId == "B")
        #expect((state.hands["B"] ?? []).count > 0)
    }
}
