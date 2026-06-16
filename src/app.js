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
export let localPlayerKey = null; // Exported to allow visibility check if needed

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

    if (state.turn.gameStatus === 'PLAYING' && activePlayer && activePlayer.isAI) {
        // Enforce a natural 1-second delay so the AI doesn't play instantly like a machine
        setTimeout(() => {
            // Re-verify it is still the AI's turn after the timeout delay
            if (state.turn.currentTurn === currentTurnKey && state.turn.gameStatus === 'PLAYING') {
                const aiAction = computeBestAIMove(state, currentTurnKey);
                dispatch(aiAction, true); // Process locally and broadcast if connected
            }
        }, 1000);
    }
}

/**
 * Triggered if the WebRTC peer connection cuts out mid-match.
 * Activates the dynamic AI Takeover layer instantly without killing the application.
 */
function handlePeerDisconnect() {
    console.warn("System Alert: Opponent dropped! Transferring control to AI Brain...");
    
    const updatedState = JSON.parse(JSON.stringify(state));
    updatedState.session.opponentDisconnected = true;
    
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
    // Structural bypass for network peer alignment setup
    if (action.type === 'START_NETWORK_GAME') {
        onStateMutated(action.payload);
        return;
    }

    // Run standard actions through our deterministic rule validator/reducer
    const nextState = handleGameAction(state, action);
    
    // Commit the new state variant locally
    onStateMutated(nextState);

    // If the action happened on this machine, serialize and beam it across the WebRTC wire
    if (originIsLocal && state.session.peerConnected) {
        broadcastGameAction(action);
    }
}

// --- UI Action Bindings ---

export async function actionCreateRoom() {
    localPlayerKey = 'host';
    state.session.isHost = true;

    try {
        const roomId = await initializeHost(
            (remoteAction) => dispatch(remoteAction, false), 
            () => handlePeerDisconnect()                     
        );

        state.session.roomId = roomId;
        window.currentRoomId = roomId; // Assign fallback anchor safely to window context
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
 */
export function actionStartMatch() {
    if (!state.session.isHost) return;

    const setupState = JSON.parse(JSON.stringify(state));
    
    let completeDeck = generateRawDeck();
    completeDeck.sort(() => Math.random() - 0.5); 

    setupState.players.host.hand = completeDeck.splice(0, 4);
    setupState.players.client.hand = completeDeck.splice(0, 4);

    let validStartingTopCard = completeDeck.pop();
    while (validStartingTopCard.number === 20) {
        completeDeck.unshift(validStartingTopCard);
        validStartingTopCard = completeDeck.pop();
    }
    setupState.discardPile.push(validStartingTopCard);
    setupState.deck = completeDeck;

    setupState.session.peerConnected = true;
    setupState.turn.gameStatus = 'PLAYING';

    const initAction = { type: 'START_NETWORK_GAME', payload: setupState };
    
    // Distribute state initialization updates across network pipeline
    state = setupState;
    onStateMutated(state);
    broadcastGameAction(initAction);
}

/**
 * Configures a localized standalone match layout completely isolated from network
 * listeners, mapping the Client identity slots directly to the embedded AI execution thread.
 */
export function setupLocalAIMatch() {
    localPlayerKey = 'host';
    
    const standaloneState = createInitialState();
    standaloneState.session.isHost = true;
    standaloneState.session.peerConnected = false; 

    let completeDeck = generateRawDeck();
    completeDeck.sort(() => Math.random() - 0.5);

    standaloneState.players.host.hand = completeDeck.splice(0, 4);
    standaloneState.players.host.isAI = false;
    standaloneState.players.host.name = "You";

    standaloneState.players.client.hand = completeDeck.splice(0, 4);
    standaloneState.players.client.isAI = true; 
    standaloneState.players.client.name = "Computer AI";

    let validStartingTopCard = completeDeck.pop();
    while (validStartingTopCard.number === 20) {
        completeDeck.unshift(validStartingTopCard);
        validStartingTopCard = completeDeck.pop();
    }
    standaloneState.discardPile.push(validStartingTopCard);
    standaloneState.deck = completeDeck;
    
    // Explicitly set operational bounds directly to PLAYING before firing state mutations
    standaloneState.turn.gameStatus = 'PLAYING';
    standaloneState.turn.currentTurn = 'host'; // Enforce user starts match

    window.currentRoomId = "OFFLINE_SANDBOX";
    
    // Commit the newly configured offline match state object directly to engine
    onStateMutated(standaloneState);
    
    console.log("--- STANDALONE AI ENVIRONMENT DEPLOYED ---");
    console.log(`Top Card: ${state.discardPile[state.discardPile.length - 1].shape} ${state.discardPile[state.discardPile.length - 1].number}`);
    console.log(`Your hand strength: ${state.players.host.hand.length} cards.`);
}

/**
 * Structural UI Binder Shell output pipeline.
 */
function renderUI(gameState) {
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    console.log("--- ENGINE STATE VIEW REFRESH ---", {
        status: gameState.turn.gameStatus,
        turn: gameState.turn.currentTurn,
        topCard: topCard ? `${topCard.shape} ${topCard.number}` : "None",
        localHandCount: gameState.players[localPlayerKey || 'host']?.hand.length || 0
    });
}
    
