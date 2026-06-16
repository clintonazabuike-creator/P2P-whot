/**
 * Whot P2P by Azabuike Technologies Inc.
 * File: src/gameState.js
 * Purpose: Core game state definitions, deck generation, and immutable state helpers.
 */

export const SHAPES = {
    CIRCLE: 'Circle',
    CROSS: 'Cross',
    TRIANGLE: 'Triangle',
    STAR: 'Star',
    SQUARE: 'Square',
    WHOT: 'Whot'
};

export const ACTIONS = {
    START_GAME: 'START_GAME',
    PLAY_CARD: 'PLAY_CARD',
    DRAW_CARD: 'DRAW_CARD',
    CHOOSE_MARKET: 'CHOOSE_MARKET',
    AI_TURN: 'AI_TURN',
    SYNC_STATE: 'SYNC_STATE',
    PLAYER_DISCONNECTED: 'PLAYER_DISCONNECTED'
};

export const MATCH_MODES = {
    COMPUTER: 'COMPUTER',
    LOCAL_P2P: 'LOCAL_P2P',
    ONLINE_P2P: 'ONLINE_P2P'
};

/**
 * Generates a standard Nigerian Whot! 54-card deck
 */
export function createDeck() {
    const deck = [];
    let id = 1;

    // Circles: 1-5, 7-14
    const circles = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14];
    circles.forEach(n => deck.push({ id: id++, shape: SHAPES.CIRCLE, value: n }));

    // Crosses: 1-3, 5, 7, 10, 11, 13, 14
    const crosses = [1, 2, 3, 5, 7, 10, 11, 13, 14];
    crosses.forEach(n => deck.push({ id: id++, shape: SHAPES.CROSS, value: n }));

    // Triangles: 1-5, 7-14
    const triangles = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14];
    triangles.forEach(n => deck.push({ id: id++, shape: SHAPES.TRIANGLE, value: n }));

    // Stars: 1-5, 7, 8, 11, 12, 13, 14 (Stars double their score value in traditional counts)
    const stars = [1, 2, 3, 4, 5, 7, 8, 11, 12, 13, 14];
    stars.forEach(n => deck.push({ id: id++, shape: SHAPES.STAR, value: n }));

    // Squares: 1-3, 5, 7, 10, 11, 13, 14
    const squares = [1, 2, 3, 5, 7, 10, 11, 13, 14];
    squares.forEach(n => deck.push({ id: id++, shape: SHAPES.SQUARE, value: n }));

    // Whot (Wildcards): 5 cards altogether, all assigned value 20
    for (let i = 0; i < 5; i++) {
        deck.push({ id: id++, shape: SHAPES.WHOT, value: 20 });
    }

    return deck;
}

/**
 * Knuth-Shuffle for unbiased card distribution
 */
export function shuffle(deck) {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}

/**
 * Initializes a pristine, structure-validated game state object
 */
export function initializeState(matchMode, hostName = "Player 1", guestName = "Opponent") {
    return {
        matchMode,
        players: [
            { id: "p1", name: hostName, hand: [], isBot: false, score: 0 },
            { id: "p2", name: guestName, hand: [], isBot: matchMode === MATCH_MODES.COMPUTER, score: 0 }
        ],
        deck: [],
        discardPile: [],
        currentTurnIdx: 0, // 0 = Player 1, 1 = Player 2
        activeDemandShape: null, // Holds the shape requested by a Whot (20) card
        turnPenaltyStack: 0, // Accumulator for Pick Two (2) and Pick Three (5)
        holdOnActive: false, // Tracks if a "Hold On" (1) is active
        winnerId: null,
        gameLog: ["Engine initialized. Ready to deal."]
    };
}

export function deepCloneState(state) {
    return JSON.parse(JSON.stringify(state));
}
