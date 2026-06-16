/**
 * Whot P2P by Azabuike Technologies Inc.
 * File: src/aiEngine.js
 * Purpose: Deterministic tactical heuristic weight matrix for local AI gameplay execution.
 */

import { ACTIONS, SHAPES } from './gameState.js';
import { RulesEngine } from './rulesEngine.js';

export const AIEngine = {
    /**
     * Analyzes state and generates the mathematically optimal structural play action
     */
    computeOptimalTurn(gameState, aiPlayerId) {
        const aiPlayer = gameState.players.find(p => p.id === aiPlayerId);
        const topCard = gameState.discardPile[gameState.discardPile.length - 1];
        const { activeDemandShape, turnPenaltyStack } = gameState;

        // Filter out completely illegal cards
        const legalMoves = aiPlayer.hand.filter(card => 
            RulesEngine.isCardPlayable(card, topCard, activeDemandShape, turnPenaltyStack)
        );

        // If no moves are legal, AI must hit the Market deck
        if (legalMoves.length === 0) {
            return { type: ACTIONS.DRAW_CARD, payload: { playerId: aiPlayerId } };
        }

        // Heuristic Scoring System to select the absolute best card
        let bestCard = null;
        let highestScore = -Infinity;

        legalMoves.forEach(card => {
            let score = 0;

            // Rule 1: Chain dynamic stack attacks (2 and 5) if a penalty is active
            if (turnPenaltyStack > 0 && (card.value === 2 || card.value === 5)) {
                score += 100;
            }

            // Rule 2: Prioritize tactical utility mechanics (Hold On: 1, Suspension: 14)
            if (card.value === 1 || card.value === 14) {
                score += 25;
            }

            // Rule 3: Frequency alignment (favor shapes that the AI holds multiple of)
            const shapeCount = aiPlayer.hand.filter(c => c.shape === card.shape).length;
            score += shapeCount * 5;

            // Rule 4: Value distribution (burn high value numbers to lower end-game exposure)
            score += card.value * 0.5;

            // Rule 5: Keep Whot (20) Wildcards as defense mechanisms for complex turns
            if (card.shape === SHAPES.WHOT) {
                if (aiPlayer.hand.length > 2) {
                    score -= 15; // De-prioritize wildcards if hand size is healthy
                } else {
                    score += 50; // Use it aggressively to secure victory if cards are low
                }
            }

            if (score > highestScore) {
                highestScore = score;
                bestCard = card;
            }
        });

        // If the AI chooses to play a Whot (20) card, calculate the optimal shape demand
        let chosenDemandShape = null;
        if (bestCard.shape === SHAPES.WHOT) {
            chosenDemandShape = AIEngine.calculateDominantShape(aiPlayer.hand);
        }

        return {
            type: ACTIONS.PLAY_CARD,
            payload: {
                playerId: aiPlayerId,
                cardId: bestCard.id,
                chosenDemandShape
            }
        };
    },

    /**
     * Determines which shape occurs most frequently within the AI hand to optimize target demands
     */
    calculateDominantShape(hand) {
        const counts = {};
        let dominantShape = SHAPES.CIRCLE;
        let maxCount = -1;

        hand.forEach(card => {
            if (card.shape !== SHAPES.WHOT) {
                counts[card.shape] = (counts[card.shape] || 0) + 1;
                if (counts[card.shape] > maxCount) {
                    maxCount = counts[card.shape];
                    dominantShape = card.shape;
                }
            }
        });

        return dominantShape;
    }
};
