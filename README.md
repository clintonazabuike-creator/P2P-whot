# Whot P2P by Azabuike Technologies Inc.

A highly optimized, serverless, modular edition of the traditional Nigerian Whot! card game layout. Engineered with pure Vanilla ES Modules and decoupled state machines to run completely peer-to-peer over WebRTC data tracks.

## 📂 Architecture Framework Layout
## 🛠️ Execution & Deployment Pipeline Instructions
The codebase relies completely on native browser ES Modules. No bundlers or build steps (Webpack/Vite) are required.

### Local Static Hosting Testing
To prevent CORS errors originating from modular imports executing on file:// protocols, execute using any localized development server configuration:
* Using Python: `python -m http.server 8000`
* Using Node runtime tooling: `npx serve`

### Continuous Cloud Integration
To deploy instantly to production:
1. Initialize a Git repository containing the codebase: `git init`
2. Push directly to a public **GitHub Pages** tracking branch.
3. Or immediately drag-and-drop the directory structure into zero-config sandboxes such as **StackBlitz** or **Netlify Drop**.

4. ├── index.html               # Presentation canvas view layer and CDN pipeline links
├── README.md                # Structural validation documentation
└── src
├── aiEngine.js          # Tactical heuristic weight calculation matrices
├── app.js               # Event pipelines and state mesh synchronization coordinator
├── gameReducer.js       # Pure structural mutation reducer logic
├── gameState.js         # Deck structures and definition constants
├── p2pConnection.js     # PeerJS abstraction layer handles WebRTC routing
└── rulesEngine.js       # Stateless game engine referee validators
