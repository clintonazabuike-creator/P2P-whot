/**
 * ARCHITECTURE NOTE:
 * This module manages low-latency P2P data synchronization over WebRTC via PeerJS.
 * It broadcasts atomic action payloads to ensure both clients mirror the exact same state.
 */

let peerInstance = null;
let activeConnection = null;

/**
 * Initializes a PeerJS instance for the Host and sets up connection listeners.
 * @param {Function} onStateUpdateCallback - Triggered when a validated remote action is received.
 * @param {Function} onDisconnectCallback - Triggered if the connection drops (triggers AI Takeover).
 * @returns {Promise<String>} - Resolves with the unique Room/Peer ID.
 */
export function initializeHost(onStateUpdateCallback, onDisconnectCallback) {
    return new Promise((resolve, reject) => {
        // Initialize PeerJS. Uses public cloud signaling for initial handshake discovery only.
        peerInstance = new Peer();

        peerInstance.on('open', (id) => {
            resolve(id); // This ID becomes the Room Code shared with the client
        });

        peerInstance.on('connection', (conn) => {
            activeConnection = conn;
            setupDataChannelListeners(onStateUpdateCallback, onDisconnectCallback);
        });

        peerInstance.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Connects a Guest/Client to an existing Host's Room ID.
 * @param {String} hostRoomId - The Room ID provided by the host.
 * @param {Function} onStateUpdateCallback - Triggered when a validated remote action is received.
 * @param {Function} onDisconnectCallback - Triggered if the host drops.
 */
export function connectToRoom(hostRoomId, onStateUpdateCallback, onDisconnectCallback) {
    peerInstance = new Peer();

    peerInstance.on('open', () => {
        activeConnection = peerInstance.connect(hostRoomId, {
            reliable: true // Enforces TCP-like delivery confirmation for structural card actions
        });

        setupDataChannelListeners(onStateUpdateCallback, onDisconnectCallback);
    });
}

/**
 * Internal helper to bind state synchronization events onto the active WebRTC channel.
 */
function setupDataChannelListeners(onStateUpdate, onDisconnect) {
    if (!activeConnection) return;

    activeConnection.on('open', () => {
        console.log("P2P Data Channel Securely Established.");
    });

    activeConnection.on('data', (data) => {
        try {
            // De-serialize incoming action payloads from across the network
            const action = typeof data === 'string' ? JSON.parse(data) : data;
            
            if (action && action.type) {
                onStateUpdate(action);
            }
        } catch (error) {
            console.error("Malformed state transmission dropped:", error);
        }
    });

    activeConnection.on('close', () => {
        console.warn("Direct P2P link severed.");
        onDisconnect();
    });

    activeConnection.on('error', (err) => {
        console.error("P2P Channel Error:", err);
        onDisconnect();
    });
}

/**
 * Broadcasts an atomic game action across the direct peer-to-peer data connection.
 * @param {Object} action - The action object (e.g., { type: 'PLAY_CARD', payload: {...} })
 */
export function broadcastGameAction(action) {
    if (activeConnection && activeConnection.open) {
        // Send the action payload directly into the WebRTC data channel buffer
        activeConnection.send(JSON.stringify(action));
    } else {
        console.error("Transmission failed: P2P data connection is offline.");
    }
}

