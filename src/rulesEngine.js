/**
 * Whot P2P by Azabuike Technologies Inc.
 * File: src/rulesEngine.js
 * Purpose: Pure, functional card validation and dynamic rule application.
 */

import { SHAPES } from './gameState.js';

export const RulesEngine = {
    /**
     * Determines if a card is legally playable on top of the current open card
     */
    isCardPlayable(card, topCard, activeDemandShape, turnPenaltyStack) {
        // If there is an active penalty stack, player MUST either play another penalty card to stack it or draw.
        if (turnPenaltyStack > 0) {
            if (topCard.value === 2 && card.value !== 2) return false;
            if (topCard.value === 5 && card.value !== 5) return false;
        }

        // Whot cards (20) are wildcards and can always be played
        if (card.shape === SHAPES.WHOT) return true;

        // If a Whot card was previously played and a shape demand is active
        if (topCard.shape === SHAPES.WHOT && activeDemandShape) {
            return card.shape === activeDemandShape;
        }

        // Normal card matching rules: Match by shape OR match by value
        return card.shape === topCard.shape || card.value === topCard.value;
    },

    /**
     * Examines a played card and returns status modifiers for the state machine
     */
    evaluateCardEffects(card) {
        const effects = {
            penaltyCardsToDraw: 0,
            holdOn: false,
            suspension: false,
            requiresDemand: false
        };

        if (card.shape === SHAPES.WHOT) {
            effects.requiresDemand = true;
            return effects;
        }

        switch (card.value) {
            case 1:  // Hold On: The current player plays again
                effects.holdOn = true;
                break;
            case 2:  // Pick Two: Next player must draw 2 or stack another 2
                effects.penaltyCardsToDraw = 2;
                break;
            case 5:  // Pick Three: Next player must draw 3 or stack another 5
                effects.penaltyCardsToDraw = 3;
                break;
            case 14: // Suspension: Next player skips their turn
                effects.suspension = true;
                break;
            default:
                break;
        }

        return effects;
    },

    /**
     * Calculates the total remaining points in a player's hand (used when market ends or game wraps)
     * Stars count double their value.
     */
    calculateHandScore(hand) {
        return hand.reduce((total, card) => {
            if (card.shape === SHAPES.STAR) {
                return total + (card.value * 2);
            }
            return total + card.value;
        }, 0);
    }
};
