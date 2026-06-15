import { createInitialState, generateRawDeck } from './gameState.js';
import { handleGameAction } from './gameReducer.js';
import { computeBestAIMove } from './aiEngine.js';
import { initializeHost, connectToRoom, broadcastGameAction } from './p2pConnection.js';

/**
 * ARCHITECTURE NOTE:
 * app.js acts as the central coordinator. It intercepts user UI inputs,
 * passes them to the reducer, manages the local state object, and invokes
 * P2P broadcasting or local AI recalculations smoothly.
 */

let state = createInitialState();
let localPlayerKey = null; // Stays 'host' or 'client' for the local user browser

/**
 * Event handler triggered whenever a valid game action alters the state.
 * Refreshes the UI loop and immediately checks if an AI action needs to run.
 */
function onStateMutated(newState) {
    state = newState;
    renderUI(state);

    // AI Check Loop: If the game is playing, and it's the current turn of an AI player, compute move
    const currentTurnKey = state.turn.currentTurn;
    const activePlayer = state.players[currentTurnKey];

    if (state.turn.gameStatus === 'PLAYING' && activePlayer.isAI) {
        // Enforce a natural 1-second delay so the AI doesn't play instantly like a machine
        setTimeout(() => {
            const aiAction = computeBestAIMove(state, currentTurnKey);
            dispatch(aiAction, true); // Process locally and broadcast
        }, 1000);
    }
}

/**
 * Triggered if the WebRTC peer connection cuts out mid-match.
 * Activates the dynamic AI Takeover layer instantly without killing the application.
 */
function handlePeerDisconnect() {
    console.warn("System Alert: Opponent dropped! Transferring control to AI Brain...");
    
    // Clone state safely to apply structural edits
    const updatedState = JSON.parse(JSON.stringify(state));
    updatedState.session.opponentDisconnected = true;
    
    // Determine who dropped and convert them into an AI bot
    if (localPlayerKey === 'host') {
        updatedState.players.client.isAI = true;
        updatedState.players.client.name = "AI Bot (Guest)";
    } else {
        updatedState.players.host.isAI = true;
        updatedState.players.host.name = "AI Bot (Host)";
    }

    onStateMutated(updatedState);
}

/**
 * Central action dispatch terminal. 
 * @param {Object} action - The rule-compliant action object.
 * @param {Boolean} originIsLocal - True if the action originated on this machine's UI.
 */
export function dispatch(action, originIsLocal = true) {
    // 1. Run the action through our deterministic rule validator/reducer
    const nextState = handleGameAction(state, action);
    
    // 2. Commit the new state variant locally
    onStateMutated(nextState);

    // 3. If the action happened on this machine, serialize and beam it across the WebRTC wire
    if (originIsLocal && state.session.peerConnected) {
        broadcastGameAction(action);
    }
}

// --- UI Action Bindings (Hook these directly to HTML button clicks) ---

export async function actionCreateRoom() {
    localPlayerKey = 'host';
    state.session.isHost = true;

    try {
        const roomId = await initializeHost(
            (remoteAction) => dispatch(remoteAction, false), // Handle inbound network actions
            () => handlePeerDisconnect()                     // Handle inbound drop signals
        );

        state.session.roomId = roomId;
        state.turn.gameStatus = 'LOBBY';
        renderUI(state);
        console.log(`Room created successfully! Code: ${roomId}`);
    } catch (err) {
        console.error("Failed to initialize P2P network infrastructure:", err);
    }
}

export function actionJoinRoom(targetRoomId) {
    localPlayerKey = 'client';
    state.session.isHost = false;
    state.session.roomId = targetRoomId;

    connectToRoom(
        targetRoomId,
        (remoteAction) => dispatch(remoteAction, false),
        () => handlePeerDisconnect()
    );

    state.turn.gameStatus = 'LOBBY';
    renderUI(state);
}

/**
 * Executes the structural deck setup and triggers the official game start match sequence.
 * Only the Host is permitted to call this method to enforce cryptographic safety.
 */
export function actionStartMatch() {
    if (!state.session.isHost) return;

    const setupState = JSON.parse(JSON.stringify(state));
    
    // 1. Compile deck array and shuffle it securely
    let completeDeck = generateRawDeck();
    completeDeck.sort(() => Math.random() - 0.5); // Fast secure inline array sort

    // 2. Deal initial hands (traditional Whot rules require 4 cards each to start)
    setupState.players.host.hand = completeDeck.splice(0, 4);
    setupState.players.client.hand = completeDeck.splice(0, 4);

    // 3. Establish initial discard stack top card
    let validStartingTopCard = completeDeck.pop();
    // A game cannot start with a wild card (20) on top of the stack
    while (validStartingTopCard.number === 20) {
        completeDeck.unshift(validStartingTopCard);
        validStartingTopCard = completeDeck.pop();
    }
    setupState.discardPile.push(validStartingTopCard);
    setupState.deck = completeDeck;

    // 4. Update operational descriptors
    setupState.session.peerConnected = true;
    setupState.turn.gameStatus = 'PLAYING';

    // 5. Package state modification as an initialization action payload and sync it
    const initAction = { type: 'START_NETWORK_GAME', payload: setupState };
    
    // Process locally first
    state = setupState;
    onStateMutated(state);
    
    // Send full raw configuration layout parameters down the pipe to sync Client machine
    broadcastGameAction(initAction);
}

/**
 * Structural UI Binder Shell. Replace console logging mechanisms with 
 * your chosen web display layout framework (Vanilla DOM, React, Canvas, etc.).
 */
function renderUI(gameState) {
    console.log("--- ENGINE STATE VIEW REFRESH ---", {
        status: gameState.turn.gameStatus,
        turn: gameState.turn.currentTurn,
        topCard: gameState.discardPile[gameState.discardPile.length - 1],
        localHand: gameState.players[localPlayerKey]?.hand || []
    });
          }

