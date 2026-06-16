/**
 * Whot P2P by Azabuike Technologies Inc.
 * File: src/gameReducer.js
 * Purpose: Central action handler processing deep state modifications cleanly.
 */

import { ACTIONS, createDeck, shuffle, deepCloneState, SHAPES } from './gameState.js';
import { RulesEngine } from './rulesEngine.js';

export function gameReducer(state, action) {
    const newState = deepCloneState(state);

    switch (action.type) {
        case ACTIONS.START_GAME: {
            let deck = shuffle(createDeck());
            
            // Deal 6 cards to each player
            newState.players.forEach(player => {
                player.hand = deck.splice(0, 6);
                player.score = 0;
            });

            // Flip top card, ensuring it's not a Whot (20) card for starter simplicity
            let topCardIdx = deck.findIndex(c => c.shape !== SHAPES.WHOT);
            if (topCardIdx === -1) topCardIdx = 0;
            const [topCard] = deck.splice(topCardIdx, 1);

            newState.discardPile = [topCard];
            newState.deck = deck;
            newState.currentTurnIdx = 0;
            newState.activeDemandShape = null;
            newState.turnPenaltyStack = 0;
            newState.winnerId = null;
            newState.gameLog = ["Match started! Deck shuffled and dealt."];
            return newState;
        }

        case ACTIONS.PLAY_CARD: {
            const { playerId, cardId, chosenDemandShape } = action.payload;
            const playerIdx = newState.players.findIndex(p => p.id === playerId);
            
            if (playerIdx !== newState.currentTurnIdx) return state; // Block out-of-turn plays
            
            const player = newState.players[playerIdx];
            const cardIdx = player.hand.findIndex(c => c.id === cardId);
            if (cardIdx === -1) return state;

            const card = player.hand[cardIdx];
            const topCard = newState.discardPile[newState.discardPile.length - 1];

            // Validate with referee
            if (!RulesEngine.isCardPlayable(card, topCard, newState.activeDemandShape, newState.turnPenaltyStack)) {
                return state; 
            }

            // Remove card from hand, place on top of discard pile
            player.hand.splice(cardIdx, 1);
            newState.discardPile.push(card);

            // Clean active shape demands unless reset by another demand
            newState.activeDemandShape = null;

            // Evaluate special card rules
            const effects = RulesEngine.evaluateCardEffects(card);
            
            if (effects.requiresDemand) {
                newState.activeDemandShape = chosenDemandShape || SHAPES.CIRCLE; // Default safe fall-back
                newState.gameLog.unshift(`${player.name} played WHOT! Demanded: ${newState.activeDemandShape}`);
            } else {
                newState.gameLog.unshift(`${player.name} played ${card.shape} ${card.value}`);
            }

            // Apply card stacks
            if (effects.penaltyCardsToDraw > 0) {
                newState.turnPenaltyStack += effects.penaltyCardsToDraw;
            }

            // Win condition check
            if (player.hand.length === 0) {
                newState.winnerId = player.id;
                newState.gameLog.unshift(`🎉 ${player.name} has won the match!`);
                return newState;
            }

            // Calculate next turn rotation
            if (effects.holdOn) {
                newState.gameLog.unshift(`${player.name} holds on to play again.`);
                // Turn index remains unchanged
            } else if (effects.suspension) {
                newState.gameLog.unshift(`Next player suspended!`);
                // Skips next player in 2-player mode (meaning it wraps right back to current player)
            } else {
                // Shift turn normally
                newState.currentTurnIdx = (newState.currentTurnIdx + 1) % newState.players.length;
            }

            return newState;
        }

        case ACTIONS.DRAW_CARD: {
            const { playerId } = action.payload;
            const playerIdx = newState.players.findIndex(p => p.id === playerId);
            if (playerIdx !== newState.currentTurnIdx) return state;

            const player = newState.players[playerIdx];
            
            // Re-shuffle discard pile back into deck if deck is empty
            if (newState.deck.length === 0) {
                const topCard = newState.discardPile.pop();
                newState.deck = shuffle(newState.discardPile);
                newState.discardPile = [topCard];
                newState.gameLog.unshift("Market refilled from discard pile.");
            }

            // Determine if pulling penalties or pulling single market share
            const cardsToDrawCount = newState.turnPenaltyStack > 0 ? newState.turnPenaltyStack : 1;
            newState.gameLog.unshift(`${player.name} draws ${cardsToDrawCount} card(s) from Market.`);

            for (let i = 0; i < cardsToDrawCount; i++) {
                if (newState.deck.length > 0) {
                    player.hand.push(newState.deck.shift());
                }
            }

            // Reset penalty stack
            newState.turnPenaltyStack = 0;

            // Drawing shifts turn unless a penalty loop was cleared (standard regional variant yields turn after drawing market)
            newState.currentTurnIdx = (newState.currentTurnIdx + 1) % newState.players.length;

            return newState;
        }

        case ACTIONS.SYNC_STATE: {
            return action.payload.state;
        }

        case ACTIONS.PLAYER_DISCONNECTED: {
            const { playerId } = action.payload;
            const targetPlayer = newState.players.find(p => p.id === playerId);
            if (targetPlayer) {
                targetPlayer.isBot = true;
                targetPlayer.name += " (AI Autopilot)";
                newState.gameLog.unshift(`⚠️ Connection dropped. AI took over ${targetPlayer.name}.`);
            }
            return newState;
        }

        default:
            return state;
    }
}

