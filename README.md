# P2P-whot# 

🃏 P2P Whot Engine (Serverless Architecture)

A high-performance, ultra-stable, serverless Peer-to-Peer (P2P) implementation of the traditional African card game **Whot!**. This application runs entirely on client devices and utilizes WebRTC data channels for low-latency gameplay sync, backed by a deterministic local AI engine for single-player play and seamless rage-quit protection.

---

## ⚡ Key Architectural Features

* **Zero Cloud Architecture:** Hosted entirely free on GitHub Pages. No backend data infrastructure, no server maintenance bills, and zero database latency.
* **Direct WebRTC Pipeline:** Leverages PeerJS data pipes to link browsers directly. Game actions are passed as lightweight JSON packets, bypassing the need for an intermediate multiplayer server.
* **Deterministic "Old AI" Brain:** Built with a localized heuristic weight matrix. The AI calculates moves based on current threat vectors, point dumping strategies, and suit dominance without calling heavy external APIs.
* **Automated AI Takeover:** If a remote player experiences a network drop or closes their browser tab, the local WebRTC closure hook triggers seamlessly—flipping the missing player's status to an AI bot instantly to preserve the match.
* **Cryptographic Sync Lock:** The Host machine establishes, shuffles, and signs the deck blueprint before broadcasting it to the Client, preventing client-side card injection memory manipulation.

---

## 📂 Repository File Structure

```development
├── index.html          # Main application entry canvas markup
├── src/
│   ├── gameState.js    # Immutable core structures, configurations, & deck specs
│   ├── rulesEngine.js  # Stateless gatekeeper enforcing traditional Whot! rules
│   ├── gameReducer.js  # Centralized action processor/state mutation factory
│   ├── aiEngine.js     # Tactical heuristic matrix for autonomous player routines
│   ├── p2pConnection.js# WebRTC discovery, data bindings, & connection tracking
│   └── app.js          # Main coordinator linking UI events, engine state, & network
└── README.md           # Technical documentation and deployment roadmap
