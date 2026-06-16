/**
 * Whot P2P by Azabuike Technologies Inc.
 * File: src/p2pConnection.js
 * Purpose: WebRTC network lifecycle mesh management using PeerJS.
 */

export class P2PConnectionManager {
    constructor(onMessageCallback, onDisconnectCallback) {
        this.peer = null;
        this.connection = null;
        this.onMessageCallback = onMessageCallback;
        this.onDisconnectCallback = onDisconnectCallback;
        this.isHost = false;
    }

    /**
     * Instantiates a PeerJS instance and returns a unique local ID
     */
    initializePeer(customId = null) {
        return new Promise((resolve, reject) => {
            // Using standard public cloud PeerJS infrastructure
            this.peer = customId ? new Peer(customId) : new Peer();

            this.peer.on('open', (id) => {
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                if (!this.isHost) {
                    // Host mode auto-accepts incoming connections
                    this.isHost = true;
                    this.connection = conn;
                    this.setupConnectionListeners();
                } else {
                    // Deny multiple connections to ensure a rigid 1v1 match
                    conn.on('open', () => {
                        conn.send({ type: 'SYSTEM_ERROR', payload: 'Room Full' });
                        conn.close();
                    });
                }
            });

            this.peer.on('error', (err) => {
                console.error("PeerJS Core Error:", err);
                reject(err);
            });
        });
    }

    /**
     * Connects a visitor to a target room host ID
     */
    connectToPeer(targetPeerId) {
        return new Promise((resolve, reject) => {
            if (!this.peer) return reject("Local node uninitialized.");

            this.isHost = false;
            this.connection = this.peer.connect(targetPeerId, { reliable: true });

            this.connection.on('open', () => {
                this.setupConnectionListeners();
                resolve(this.connection);
            });

            this.connection.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Attaches data stream and termination listeners to active connections
     */
    setupConnectionListeners() {
        this.connection.on('data', (data) => {
            if (this.onMessageCallback) {
                this.onMessageCallback(data);
            }
        });

        this.connection.on('close', () => {
            if (this.onDisconnectCallback) {
                this.onDisconnectCallback();
            }
        });

        this.connection.on('error', (err) => {
            console.error("Data Stream Error:", err);
        });
    }

    /**
     * Dispatches transactional JSON payloads across the network
     */
    broadcast(actionPayload) {
        if (this.connection && this.connection.open) {
            this.connection.send(actionPayload);
        } else {
            console.warn("Broadcast dropped: No active connection stream.");
        }
    }

    /**
     * Gracefully tears down the connection node
     */
    disconnect() {
        if (this.connection) this.connection.close();
        if (this.peer) this.peer.destroy();
    }
}

