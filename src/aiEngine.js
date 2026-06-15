import { isValidMove } from './rulesEngine.js';
import { SHAPES } from './gameState.js';

/**
 * ARCHITECTURE NOTE:
 * This engine acts as a pure calculation layer. It reads state and returns
 * a standardized action payload. It requires zero cloud infrastructure.
 */

/**
 * Evaluates the current state and determines the AI's best tactical move.
 * @param {Object} gameState - The current full game state object.
 * @param {String} aiPlayerKey - Either 'host' or 'client' depending on AI assignment.
 * @returns {Object} - An action payload ready to be dispatched directly to gameReducer.js.
 */
export function computeBestAIMove(gameState, aiPlayerKey) {
    const aiPlayer = gameState.players[aiPlayerKey];
    const opponentKey = aiPlayerKey === 'host' ? 'client' : 'host';
    const opponentCardCount = gameState.players[opponentKey].hand.length;

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    const activeSuit = gameState.turn.activeSuit;
    const activePenalty = gameState.turn.cardsToDraw;

    let bestCard = null;
    let highestScore = -1;

    // 1. Scan the AI's hand to score every valid playable card
    for (const card of aiPlayer.hand) {
        if (!isValidMove(card, topCard, activeSuit)) continue;

        // If a penalty stack is active, enforce penalty-defense rule matching
        if (activePenalty > 0) {
            const isDefending = (topCard.number === 2 && card.number === 2) || 
                                (topCard.number === 14 && card.number === 14);
            if (!isDefending) continue; // Skip non-defense cards when penalized
        }

        let score = 0;

        // --- Strategic Scoring Matrix ---

        // Rule A: High Urgency Threat Response (Opponent has 1 or 2 cards left)
        if (opponentCardCount <= 2) {
            if (card.number === 2 || card.number === 14) score += 200; // Attack them heavily
            if (card.number === 1) score += 150; // Hold on to stall their win
        }

        // Rule B: Card Point Dumping (Dump high numbers early to avoid penalty during tracking)
        score += card.pointValue * 2.0;

        // Rule C: Shape Synergies (Prioritize shapes that the AI has more of in its hand)
        const shapeCount = aiPlayer.hand.filter(c => c.shape === card.shape).length;
        score += shapeCount * 10;

        // Rule D: Whot 20 Strategic Preservation
        if (card.shape === SHAPES.WHOT) {
            if (aiPlayer.hand.length === 1) {
                score = 500; // Play immediately if it's the final card to win the game
            } else if (opponentCardCount <= 2) {
                score = 180; // Emergency play to redirect suit away from opponent's flow
            } else {
                score = 5;   // Otherwise hoard it for tactical defense later
            }
        }

        // Keep track of the highest scoring option
        if (score > highestScore) {
            highestScore = score;
            bestCard = card;
        }
    }

    // 2. Decide Action: If no valid cards scored, the AI must go to Market (Draw)
    if (!bestCard) {
        return {
            type: 'DRAW_CARD',
            payload: { playerKey: aiPlayerKey }
        };
    }

    // 3. Contextual Shape Resolution if playing a Whot card (20)
    let chosenSuitSelection = null;
    if (bestCard.shape === SHAPES.WHOT) {
        chosenSuitSelection = calculateMajorityShape(aiPlayer.hand, bestCard.id);
    }

    return {
        type: 'PLAY_CARD',
        payload: {
            playerKey: aiPlayerKey,
            cardId: bestCard.id,
            suitSelection: chosenSuitSelection
        }
    };
}

/**
 * Helper to analyze the AI's hand and select the shape it holds the most of,
 * ensuring optimal suit switching when a Whot card is deployed.
 */
function calculateMajorityShape(hand, whotCardId) {
    const counts = {};
    let dominantShape = SHAPES.CIRCLE; // Default fallback
    let maxCount = -1;

    for (const card of hand) {
        if (card.id === whotCardId || card.shape === SHAPES.WHOT) continue;
        counts[card.shape] = (counts[card.shape] || 0) + 1;

        if (counts[card.shape] > maxCount) {
            maxCount = counts[card.shape];
            dominantShape = card.shape;
        }
    }

    return dominantShape;
}
  
