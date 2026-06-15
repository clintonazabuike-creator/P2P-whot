import { isValidMove, getCardEffects } from './rulesEngine.js';
import { SHAPES } from './gameState.js';

/**
 * ARCHITECTURE NOTE:
 * The action processor receives an action payload, safely updates the state object,
 * and ensures that game rules are mechanically applied.
 */

export function handleGameAction(state, action) {
    // Clone state to prevent unpredictable reference mutations during processing
    const updatedState = JSON.parse(JSON.stringify(state));
    
    if (updatedState.turn.gameStatus !== 'PLAYING') return updatedState;

    switch (action.type) {
        case 'PLAY_CARD':
            return processPlayCard(updatedState, action.payload);

        case 'DRAW_CARD':
            return processDrawCard(updatedState, action.payload);

        default:
            return updatedState;
    }
}

// --- Internal Processing Sub-routines ---

function processPlayCard(state, { playerKey, cardId, suitSelection }) {
    const player = state.players[playerKey];
    
    // 1. Enforce turn isolation
    if (state.turn.currentTurn !== playerKey) return state;

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return state; // Card not found in hand

    const cardToPlay = player.hand[cardIndex];
    const topCard = state.discardPile[state.discardPile.length - 1];

    // 2. Validate move safety
    if (!isValidMove(cardToPlay, topCard, state.turn.activeSuit)) return state;

    // 3. Check for active penalties: If a player owes cards, they CANNOT play normal cards
    // They must either stack another penalty card (e.g., play a 2 on a 2) or draw.
    if (state.turn.cardsToDraw > 0) {
        const isStackingPenalty = (topCard.number === 2 && cardToPlay.number === 2) || 
                                  (topCard.number === 14 && cardToPlay.number === 14);
        if (!isStackingPenalty) return state; // Block the move if it doesn't defend
    }

    // 4. Move card from hand to discard pile
    player.hand.splice(cardIndex, 1);
    state.discardPile.push(cardToPlay);

    // 5. Evaluate card side effects
    const effects = getCardEffects(cardToPlay);

    // Reset active suit unless a new Whot card is redefining it
    state.turn.activeSuit = effects.mustChangeSuit ? suitSelection : null;

    // Manage penalty stacks (e.g., if a Pick 2 is played on an existing Pick 2)
    if (effects.penaltyCards > 0) {
        state.turn.cardsToDraw += effects.penaltyCards;
    }

    // 6. Check Win Condition (Game Over)
    if (player.hand.length === 0) {
        state.turn.gameStatus = 'GAME_OVER';
        return state;
    }

    // 7. Advance Turn Cycle
    if (effects.shouldSwitchTurn) {
        // Toggle turn between 'host' and 'client'
        state.turn.currentTurn = state.turn.currentTurn === 'host' ? 'client' : 'host';
    }

    return state;
}

function processDrawCard(state, { playerKey }) {
    const player = state.players[playerKey];
    
    if (state.turn.currentTurn !== playerKey) return state;

    // Fallback: If deck runs low, flip the discard pile over to recycle it
    if (state.deck.length === 0) {
        const topCard = state.discardPile.pop();
        state.deck = state.discardPile.reverse(); // Recycle
        state.discardPile = [topCard];
    }

    // Calculate how many cards must be drawn
    // If cardsToDraw > 0, the player was forced into market by a penalty card
    const count = state.turn.cardsToDraw > 0 ? state.turn.cardsToDraw : 1;

    for (let i = 0; i < count; i++) {
        if (state.deck.length > 0) {
            player.hand.push(state.deck.pop());
        }
    }

    // Reset the penalty accumulator since they have paid their market fine
    state.turn.cardsToDraw = 0;

    // Advancing turn after drawing from market
    state.turn.currentTurn = state.turn.currentTurn === 'host' ? 'client' : 'host';

    return state;
    }

