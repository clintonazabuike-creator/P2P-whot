/**
 * ARCHITECTURE NOTE:
 * To ensure absolute stability and prevent state-mutation bugs, the game engine
 * reads and updates this centralized state object via deterministic actions.
 */

// 1. Core Card Configurations
export const SHAPES = {
    CIRCLE: 'Circle',
    TRIANGLE: 'Triangle',
    CROSS: 'Cross',
    SQUARE: 'Square',
    STAR: 'Star',
    WHOT: 'Whot'
};

// The traditional Nigerian Whot deck composition (Numbers allocation per shape)
export const DECK_CONFIG = {
    [SHAPES.CIRCLE]:   [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
    [SHAPES.TRIANGLE]: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
    [SHAPES.CROSS]:    [1, 2, 3, 5, 7, 10, 11, 13, 14],
    [SHAPES.SQUARE]:   [1, 2, 3, 5, 7, 10, 11, 13, 14],
    [SHAPES.STAR]:     [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14], // Note: Stars count double points at checking
    [SHAPES.WHOT]:     [20, 20, 20, 20, 20] // The wild cards
};

// 2. Initial State Factory
export function createInitialState() {
    return {
        // Networking & Session Metadata
        session: {
            roomId: null,
            isHost: false,
            peerConnected: false,
            opponentDisconnected: false, // Flag for AI takeover trigger
        },

        // Core Game Core Collections
        deck: [],            // Draw pile (Shuffled array of card objects)
        discardPile: [],     // Played cards. Last element is the current top card
        deckHash: null,      // Cryptographic signature of the deck for P2P anti-cheat validation

        // Player Registries
        players: {
            host: {
                id: null,
                name: "Host",
                hand: [],
                isAI: false
            },
            client: {
                id: null,
                name: "Guest",
                hand: [],
                isAI: false // Can switch to true dynamically if opponent drops
            }
        },

        // Turn Management & Rules State
        turn: {
            currentTurn: 'host',     // 'host' or 'client'
            activeSuit: null,        // Overrides the current shape when a Whot (20) card is played
            cardsToDraw: 0,          // Accumulator for stacked penalties (Pick Two / General Market)
            isHoldOnActive: false,   // Tracks if a player was stalled by a '1'
            gameStatus: 'LOBBY'      // 'LOBBY', 'PLAYING', 'GAME_OVER'
        },

        // Analytics / Scoring
        matchHistory: []
    };
}

// 3. Helper Factory: Generate a completely raw, un-shuffled deck
export function generateRawDeck() {
    const freshDeck = [];
    let idCounter = 0;

    for (const [shape, numbers] of Object.entries(DECK_CONFIG)) {
        for (const num of numbers) {
            freshDeck.push({
                id: `card_${idCounter++}`, // Unique identifier for DOM rendering keys and tracking
                shape: shape,
                number: num,
                // Stars carry double penalties during checking phase
                pointValue: shape === SHAPES.STAR ? num * 2 : num 
            });
        }
    }
    return freshDeck;
              }
