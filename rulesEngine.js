import { SHAPES } from './gameState.js';

/**
 * ARCHITECTURE NOTE:
 * This engine is entirely stateless. It takes pure data inputs and returns 
 * booleans or state side-effects. This prevents desynchronization over P2P networks.
 */

/**
 * Validates whether a card can be legally played on top of the current discard pile.
 * * @param {Object} cardToPlay - The card object the player is attempting to drop.
 * @param {Object} topCard - The current active card at the top of the discard pile.
 * @param {String|null} activeSuit - The suit requested by a previously played Whot (20) card.
 * @returns {Boolean} - True if the move follows official competitive rules.
 */
export function isValidMove(cardToPlay, topCard, activeSuit) {
    // 1. A 'Whot' card (20) can ALWAYS be played on any card at any time
    if (cardToPlay.shape === SHAPES.WHOT) {
        return true;
    }

    // 2. If a Whot card was previously played and an active suit change is enforced
    if (activeSuit) {
        // The player must match the requested suit, OR drop another Whot card to hijack the suit
        return cardToPlay.shape === activeSuit;
    }

    // 3. Standard Play Rules (No active Whot suit constraint)
    // The card must match either the shape OR the number of the top card
    const matchesShape = cardToPlay.shape === topCard.shape;
    const matchesNumber = cardToPlay.number === topCard.number;

    return matchesShape || matchesNumber;
}

/**
 * Evaluates a played card to see if it triggers an action or penalty flag.
 * This handles the structural "Special Cards" mechanics.
 * * @param {Object} playedCard - The card that was verified and dropped.
 * @returns {Object} - An effects payload detailing what the system must enforce next.
 */
export function getCardEffects(playedCard) {
    const effects = {
        mustChangeSuit: false,  // Triggered by 20 (Whot)
        penaltyCards: 0,        // Cards to accumulate to the next player's draw pool
        isHoldOn: false,        // Suspends the immediate next turn if true
        shouldSwitchTurn: true  // Default state, can be overridden by specific cards
    };

    switch (playedCard.number) {
        case 1: // "Hold On"
            effects.isHoldOn = true;
            effects.shouldSwitchTurn = false; // Same player plays again in a 1v1 match
            break;

        case 2: // "Pick Two"
            effects.penaltyCards = 2;
            effects.shouldSwitchTurn = true;
            break;

        case 14: // "General Market"
            effects.penaltyCards = 1;
            effects.shouldSwitchTurn = true;
            break;

        case 20: // "Whot" (Wild card)
            effects.mustChangeSuit = true;
            effects.shouldSwitchTurn = true;
            break;

        default:
            // Standard non-action card (numbers 3, 4, 5, 7, 8, 10, 11, 12, 13)
            break;
    }

    return effects;
}

