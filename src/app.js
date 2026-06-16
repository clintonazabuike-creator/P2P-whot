/**
 * Whot P2P by Azabuike Technologies Inc.
 * File: src/app.js
 * Purpose: Central coordinator linking DOM events, local states, and network handlers.
 */

import { initializeState, ACTIONS, MATCH_MODES } from './gameState.js';
import { gameReducer } from './gameReducer.js';
import { AIEngine } from './aiEngine.js';
import { RulesEngine } from './rulesEngine.js';
import { P2PConnectionManager } from './p2pConnection.js';

class WhotApplication {
    constructor() {
        this.state = null;
        this.myPlayerId = "p1"; // Default to Player 1 (Host/Local User)
        this.networkManager = null;
        this.qrScanner = null;
        
        // Cache dynamic UI element selections
        this.dom = {
            lobby: document.getElementById('lobby-screen'),
            gameboard: document.getElementById('game-screen'),
            logConsole: document.getElementById('log-console'),
            discardPile: document.getElementById('discard-pile'),
            activeDemand: document.getElementById('active-demand-indicator'),
            playerHand: document.getElementById('player-hand'),
            opponentHand: document.getElementById('opponent-hand'),
            marketDeck: document.getElementById('market-deck'),
            turnIndicator: document.getElementById('turn-indicator'),
            winnerModal: document.getElementById('winner-modal'),
            winnerText: document.getElementById('winner-text'),
            
            // P2P Specific Controls
            hostIdDisplay: document.getElementById('host-id-display'),
            qrCodeContainer: document.getElementById('qr-code-container'),
            roomIdInput: document.getElementById('room-id-input'),
            cameraScanBtn: document.getElementById('camera-scan-btn'),
            cameraReaderView: document.getElementById('camera-reader-view')
        };

        this.bindEvents();
    }

    bindEvents() {
        // Mode Selection Hooks
        document.getElementById('btn-vs-computer').addEventListener('click', () => this.startMatch(MATCH_MODES.COMPUTER));
        document.getElementById('btn-host-p2p').addEventListener('click', () => this.initiateP2PHost(false));
        document.getElementById('btn-host-local').addEventListener('click', () => this.initiateP2PHost(true));
        document.getElementById('btn-join-remote').addEventListener('click', () => this.joinRemoteMatch());
        this.dom.cameraScanBtn.addEventListener('click', () => this.startCameraScanner());
        
        // Match Action Hooks
        this.dom.marketDeck.addEventListener('click', () => this.handleMarketDraw());
        document.getElementById('btn-restart').addEventListener('click', () => this.resetToLobby());
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.dom.logConsole.innerHTML += `<div>[${timestamp}] ${message}</div>`;
        this.dom.logConsole.scrollTop = this.dom.logConsole.scrollHeight;
    }

    dispatch(action, broadcastNetwork = true) {
        this.state = gameReducer(this.state, action);
        this.render();

        if (broadcastNetwork && this.networkManager) {
            this.networkManager.broadcast({ type: 'STATE_UPDATE', payload: action });
        }

        // Handle Asynchronous Local AI Turn Triggering
        const currentPlayer = this.state.players[this.state.currentTurnIdx];
        if (!this.state.winnerId && currentPlayer.isBot) {
            setTimeout(() => {
                const aiAction = AIEngine.computeOptimalTurn(this.state, currentPlayer.id);
                this.dispatch(aiAction, true);
            }, 1200); // Fluid delay to mimic human deliberation
        }
    }

    startMatch(mode) {
        this.state = initializeState(mode, "You", mode === MATCH_MODES.COMPUTER ? "System AI" : "Opponent");
        this.dom.lobby.classList.add('hidden');
        this.dom.gameboard.classList.remove('hidden');
        this.log(`Match setup complete under ${mode} mode.`);
        
        if (mode === MATCH_MODES.COMPUTER || this.myPlayerId === "p1") {
            this.dispatch({ type: ACTIONS.START_GAME }, false);
        }
    }

    async initiateP2PHost(useQR) {
        this.myPlayerId = "p1";
        this.networkManager = new P2PConnectionManager(
            (msg) => this.handleNetworkMessage(msg),
            () => this.handleNetworkDisconnect()
        );

        this.log("Initializing WebRTC Handshake Node...");
        try {
            const hostId = await this.networkManager.initializePeer();
            this.dom.hostIdDisplay.innerText = `Room Code: ${hostId}`;
            this.log(`Room hosted. ID: ${hostId}`);

            if (useQR) {
                this.dom.qrCodeContainer.innerHTML = "";
                new QRCode(this.dom.qrCodeContainer, {
                    text: hostId,
                    width: 140,
                    height: 140
                });
            }

            // PeerJS on('connection') resolves next
            this.networkManager.peer.on('connection', () => {
                this.log("Visitor peer authorized! Spawning match board...");
                this.startMatch(useQR ? MATCH_MODES.LOCAL_P2P : MATCH_MODES.ONLINE_P2P);
            });

        } catch (err) {
            this.log(`Host Exception: ${err}`);
        }
    }

    async joinRemoteMatch() {
        const targetId = this.dom.roomIdInput.value.trim();
        if (!targetId) return alert("Please enter a valid room pairing code.");

        this.myPlayerId = "p2";
        this.networkManager = new P2PConnectionManager(
            (msg) => this.handleNetworkMessage(msg),
            () => this.handleNetworkDisconnect()
        );

        this.log(`Attempting secure alignment with node: ${targetId}`);
        try {
            await this.networkManager.initializePeer();
            await this.networkManager.connectToPeer(targetId);
            this.log("P2P Pipeline established successfully.");
            this.startMatch(MATCH_MODES.ONLINE_P2P);
        } catch (err) {
            this.log(`Connection routing failed: ${err}`);
        }
    }

    startCameraScanner() {
        this.dom.cameraReaderView.classList.remove('hidden');
        this.qrScanner = new Html5Qrcode("camera-reader-view");
        
        this.qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (decodedText) => {
                this.dom.roomIdInput.value = decodedText;
                this.log(`QR Signature Matched: ${decodedText}`);
                this.qrScanner.stop();
                this.dom.cameraReaderView.classList.add('hidden');
                this.joinRemoteMatch();
            },
            () => {} // Silent catch for continuous frame checking
        ).catch(err => this.log(`Camera Error: ${err}`));
    }

    handleNetworkMessage(message) {
        if (message.type === 'STATE_UPDATE') {
            // Apply incoming action locally without re-broadcasting it back
            this.dispatch(message.payload, false);
            if (message.payload.type === ACTIONS.START_GAME) {
                this.log("Synchronized match state loaded from host environment.");
            }
        }
    }

    handleNetworkDisconnect() {
        this.log("Alert: WebRTC data channel severed.");
        const opponentId = this.myPlayerId === "p1" ? "p2" : "p1";
        this.dispatch({ type: ACTIONS.PLAYER_DISCONNECTED, payload: { playerId: opponentId } }, false);
    }

    handleMarketDraw() {
        const activePlayer = this.state.players[this.state.currentTurnIdx];
        if (activePlayer.id !== this.myPlayerId) return;

        this.dispatch({
            type: ACTIONS.DRAW_CARD,
            payload: { playerId: this.myPlayerId }
        });
    }

    handleCardPlay(cardId) {
        const activePlayer = this.state.players[this.state.currentTurnIdx];
        if (activePlayer.id !== this.myPlayerId) return;

        const card = activePlayer.hand.find(c => c.id === cardId);
        const topCard = this.state.discardPile[this.state.discardPile.length - 1];

        if (!RulesEngine.isCardPlayable(card, topCard, this.state.activeDemandShape, this.state.turnPenaltyStack)) {
            alert("Illegal play: Card does not match active Shape, Value, or Demand conditions.");
            return;
        }

        if (card.shape === 'Whot') {
            // Spawn dynamic prompt to request standard shape demand
            const targetShape = prompt("Choose Demand Shape: Circle, Cross, Triangle, Star, or Square?");
            const validShapes = ['Circle', 'Cross', 'Triangle', 'Star', 'Square'];
            const optimizedShape = validShapes.find(s => s.toLowerCase() === (targetShape || "").toLowerCase().trim()) || 'Circle';
            
            this.dispatch({
                type: ACTIONS.PLAY_CARD,
                payload: { playerId: this.myPlayerId, cardId, chosenDemandShape: optimizedShape }
            });
        } else {
            this.dispatch({
                type: ACTIONS.PLAY_CARD,
                payload: { playerId: this.myPlayerId, cardId }
            });
        }
    }

    render() {
        const topCard = this.state.discardPile[this.state.discardPile.length - 1];
        const localPlayer = this.state.players.find(p => p.id === this.myPlayerId);
        const opponentPlayer = this.state.players.find(p => p.id !== this.myPlayerId);
        const activePlayer = this.state.players[this.state.currentTurnIdx];

        // 1. Top Card Deck Render
        this.dom.discardPile.className = `card-face shape-${topCard.shape.toLowerCase()}`;
        this.dom.discardPile.innerHTML = `<div>${topCard.shape === 'Whot' ? '★' : topCard.shape}</div><div>${topCard.value === 20 ? 'Whot' : topCard.value}</div>`;

        // 2. Clear & Redraw Active Shape Demands
        if (this.state.activeDemandShape) {
            this.dom.activeDemand.innerText = `Active Demand: ${this.state.activeDemandShape}`;
            this.dom.activeDemand.classList.remove('hidden');
        } else {
            this.dom.activeDemand.classList.add('hidden');
        }

        // 3. Render Status Turn Metadata Bar
        this.dom.turnIndicator.innerText = `Current Turn: ${activePlayer.name} ${this.state.turnPenaltyStack > 0 ? `(Must match Penalty stack: +${this.state.turnPenaltyStack}!)` : ''}`;

        // 4. Render Local Player Hand
        this.dom.playerHand.innerHTML = "";
        localPlayer.hand.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = `card-face shape-${card.shape.toLowerCase()}`;
            cardEl.innerHTML = `<div>${card.shape === 'Whot' ? '★' : card.shape}</div><div>${card.value === 20 ? 'Whot' : card.value}</div>`;
            
            if (activePlayer.id === this.myPlayerId) {
                cardEl.classList.add('playable');
                cardEl.addEventListener('click', () => this.handleCardPlay(card.id));
            }
            this.dom.playerHand.appendChild(cardEl);
        });

        // 5. Render Opponent Obfuscated Card Counts
        this.dom.opponentHand.innerHTML = "";
        for (let i = 0; i < opponentPlayer.hand.length; i++) {
            const cardBack = document.createElement('div');
            cardBack.className = "card-face card-back";
            cardBack.innerHTML = "<div>Whot!</div>";
            this.dom.opponentHand.appendChild(cardBack);
        }

        // 6. Push Game Logs
        if (this.state.gameLog.length > 0) {
            this.log(this.state.gameLog[0]);
            this.state.gameLog = []; // Prevent looping duplicates on sync triggers
        }

        // 7. Check Victory State Trigger
        if (this.state.winnerId) {
            const winner = this.state.players.find(p => p.id === this.state.winnerId);
            this.dom.winnerText.innerText = `${winner.name} wins the match!`;
            this.dom.winnerModal.classList.remove('hidden');
        }
    }

    resetToLobby() {
        if (this.networkManager) this.networkManager.disconnect();
        this.dom.winnerModal.classList.add('hidden');
        this.dom.gameboard.classList.add('hidden');
        this.dom.lobby.classList.remove('hidden');
        this.dom.logConsole.innerHTML = "<div>System reset. Welcome back to Lobby.</div>";
    }
}

// Global Startup Initializer
window.addEventListener('DOMContentLoaded', () => {
    window.AppEngine = new WhotApplication();
});
                
